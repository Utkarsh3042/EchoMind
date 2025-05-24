import os
import re
import glob
from bs4 import BeautifulSoup
import logging
from datetime import datetime
from twilio.rest import Client
import json
import time
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("email_to_sms.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

def load_settings():
    """Load settings from file"""
    settings_file = os.path.join(os.path.dirname(__file__), 'data', 'settings.json')
    if os.path.exists(settings_file):
        with open(settings_file, 'r') as f:
            return json.load(f)
    return {}

def format_phone_number(phone_number):
    """Format a phone number to E.164 format for Twilio"""
    if not phone_number:
        return None
        
    # Remove any non-digit characters except plus sign
    clean_number = ''.join(c for c in phone_number if c.isdigit() or c == '+')
    
    # If it doesn't start with +, assume it's a US number
    if not clean_number.startswith('+'):
        clean_number = '+1' + clean_number
        
    return clean_number

def send_sms(phone_number, message):
    """Send SMS using Twilio"""
    try:
        logger.info(f"Attempting to send SMS to {phone_number}")
        
        # Load credentials directly from environment for each attempt
        account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
        
        # If no phone number is provided, use the default recipient
        if not phone_number:
            phone_number = os.getenv('RECIPIENT_PHONE_NUMBER')
            logger.info(f"No phone number provided, using default: {phone_number}")
        
        # Format phone numbers
        recipient_phone = format_phone_number(phone_number)
        twilio_phone = format_phone_number(twilio_phone)
        
        # Check if we have all required credentials
        if not all([account_sid, auth_token, twilio_phone, recipient_phone]):
            logger.error("Missing Twilio credentials")
            logger.error(f"TWILIO_ACCOUNT_SID: {'Set' if account_sid else 'MISSING'}")
            logger.error(f"TWILIO_AUTH_TOKEN: {'Set' if auth_token else 'MISSING'}")
            logger.error(f"TWILIO_PHONE_NUMBER: {twilio_phone if twilio_phone else 'MISSING'}")
            logger.error(f"Recipient phone: {recipient_phone if recipient_phone else 'MISSING'}")
            return False
        
        logger.info(f"Sending SMS from {twilio_phone} to {recipient_phone}")
        logger.info(f"Message content: {message}")
        
        # Create client and send message
        try:
            client = Client(account_sid, auth_token)
            message_obj = client.messages.create(
                body=message,
                from_=twilio_phone,
                to=recipient_phone
            )
            logger.info(f"SMS sent successfully with SID: {message_obj.sid}")
            return True
        except Exception as e:
            logger.error(f"Twilio error sending SMS: {str(e)}")
            # Check for specific Twilio error codes
            from twilio.base.exceptions import TwilioRestException
            if isinstance(e, TwilioRestException):
                logger.error(f"Twilio error code: {e.code}")
                if e.code == 21211:
                    logger.error("Invalid 'To' phone number format. Make sure it's in E.164 format.")
                elif e.code == 21602:
                    logger.error("Twilio account lacks permission to send SMS to this region.")
                elif e.code == 21608:
                    logger.error("Invalid 'From' phone number. Check your Twilio phone number.")
                elif e.code == 20003:
                    logger.error("Authentication failed. Check your Twilio credentials.")
            return False
    except Exception as outer_e:
        logger.error(f"Unexpected error in send_sms: {str(outer_e)}")
        return False

def extract_data_from_email_file(file_path):
    """Extract relevant data from an email HTML file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Determine email type from title or content
        header_text = ""
        header = soup.select_one('.header')
        if header:
            header_text = header.text.strip()
        
        data = {
            "type": "unknown",
            "items": [],
            "title": header_text,
            "filepath": file_path
        }
        
        # Check for due now emails (highest priority)
        if "Due Now" in header_text or "Reminder - Due Now" in header_text:
            data["type"] = "due_now"
            logger.info(f"Found 'due now' email: {file_path}")
            
            items = soup.select('.item')
            logger.info(f"Found {len(items)} items in due now email")
            
            for item in items:
                item_data = {}
                
                # Get title/name
                title_elem = item.select_one('.title')
                if title_elem:
                    item_data["name"] = title_elem.text.strip()
                    logger.info(f"Item name: {item_data['name']}")
                
                # Get scheduled time
                time_elem = item.select_one('.time')
                if time_elem:
                    # Extract time using regex
                    time_match = re.search(r'Scheduled for:\s*([^(]+)(?:\s*\(NOW\))?', time_elem.text)
                    if time_match:
                        item_data["time"] = time_match.group(1).strip()
                        logger.info(f"Item time: {item_data['time']}")
                
                # Get all descriptions
                desc_elements = item.select('.description')
                for desc_elem in desc_elements:
                    desc_text = desc_elem.text.strip()
                    if "Dosage:" in desc_text:
                        item_data["dosage"] = desc_text.replace("Dosage:", "").strip()
                    elif "Instructions:" in desc_text:
                        item_data["instructions"] = desc_text.replace("Instructions:", "").strip()
                    else:
                        item_data["description"] = desc_text
                
                data["items"].append(item_data)
        
        # Also check for missed medication emails
        elif "Missed" in header_text:
            data["type"] = "missed"
            items = soup.select('.item')
            
            for item in items:
                item_data = {}
                
                # Get title/name
                title_elem = item.select_one('.title')
                if title_elem:
                    item_data["name"] = title_elem.text.strip()
                
                # Get scheduled time
                time_elem = item.select_one('.time')
                if time_elem:
                    # Extract time using regex
                    time_match = re.search(r'Scheduled for:\s*([^(]+)', time_elem.text)
                    if time_match:
                        item_data["time"] = time_match.group(1).strip()
                
                # Get description if available
                desc_elements = item.select('.description')
                for desc_elem in desc_elements:
                    desc_text = desc_elem.text.strip()
                    if "Dosage:" in desc_text:
                        item_data["dosage"] = desc_text.replace("Dosage:", "").strip()
                    elif "Instructions:" in desc_text:
                        item_data["instructions"] = desc_text.replace("Instructions:", "").strip()
                    else:
                        item_data["description"] = desc_text
                
                data["items"].append(item_data)
        
        else:
            # Generic extraction for other email types
            data["type"] = "general"
            paragraphs = soup.select('p')
            data["content"] = " ".join([p.text.strip() for p in paragraphs])
        
        return data
    
    except Exception as e:
        logger.error(f"Error extracting data from email file {file_path}: {str(e)}")
        return None

def create_sms_from_email_data(email_data, phone_number=None):
    """Create and send SMS messages based on extracted email data"""
    if not email_data:
        logger.error("No email data provided to create SMS")
        return False
    
    data_type = email_data.get("type", "unknown")
    success = False
    file_path = email_data.get("filepath", "unknown file")
    
    logger.info(f"Creating SMS from email type: {data_type} from file: {file_path}")
    
    if data_type == "due_now":
        # Create message for due now items (highest priority)
        items = email_data.get("items", [])
        if items:
            logger.info(f"Processing {len(items)} due now items for SMS")
            for item in items:
                name = item.get("name", "unnamed item")
                time = item.get("time", "now")
                
                message = f"REMINDER: It's time to take/complete {name} now. "
                
                # Add additional details if available
                if "dosage" in item:
                    message += f"Dosage: {item['dosage']}. "
                if "instructions" in item:
                    message += f"Instructions: {item['instructions']}. "
                
                logger.info(f"Due now SMS content: {message}")
                
                # Send the SMS
                success = send_sms(phone_number, message)
                
                # Log the result
                if success:
                    logger.info(f"SMS sent for due item: {name}")
                else:
                    logger.error(f"Failed to send SMS for due item: {name}")
                
                # Add a short delay between messages
                time.sleep(1)
        else:
            logger.warning(f"No items found in due now email: {file_path}")
    
    elif data_type == "missed":
        # Create message for missed items
        items = email_data.get("items", [])
        if items:
            for item in items:
                name = item.get("name", "unnamed item")
                time = item.get("time", "scheduled time")
                
                message = f"MISSED ALERT: You missed {name} at {time}. "
                
                # Add additional details if available
                if "dosage" in item:
                    message += f"Dosage: {item['dosage']}. "
                if "instructions" in item:
                    message += f"Instructions: {item['instructions']}. "
                
                message += "Please take/complete it now."
                
                # Send the SMS
                success = send_sms(phone_number, message)
                
                # Log the result
                if success:
                    logger.info(f"SMS sent for missed item: {name}")
                else:
                    logger.error(f"Failed to send SMS for missed item: {name}")
                
                # Add a short delay between messages
                time.sleep(1)
    
    else:
        # Generic message for other types
        message = f"Health reminder: {email_data.get('title', 'EchoMind Notification')}. "
        if "content" in email_data:
            # Truncate content to fit SMS length limits
            content = email_data["content"]
            if len(content) > 100:
                content = content[:97] + "..."
            message += content
        
        # Send the SMS
        success = send_sms(phone_number, message)
        
        # Log the result
        if success:
            logger.info(f"SMS sent for generic notification")
        else:
            logger.error(f"Failed to send SMS for generic notification")
    
    return success

def process_email_files(priority_type=None, exclude_type=None):
    """Process email HTML files in the current directory to send SMS
    
    Args:
        priority_type (str, optional): If set, only process emails of this type
        exclude_type (str, optional): If set, exclude emails of this type
    """
    settings = load_settings()
    
    # Get phone number from settings or environment
    phone_number = os.getenv('RECIPIENT_PHONE_NUMBER')
    settings_sms = settings.get('sms_config', {})
    if settings_sms.get('phone_number'):
        phone_number = settings_sms.get('phone_number')
    
    # Get all HTML files matching the email patterns
    email_files = glob.glob("last_*.html")
    processed_count = 0
    
    logger.info(f"Found {len(email_files)} email files to process")
    
    # First process due_now files if prioritized
    if priority_type:
        logger.info(f"Looking specifically for {priority_type} emails")
        for file_path in email_files:
            # Check if this file has been processed before
            processed_marker = file_path + ".processed"
            if os.path.exists(processed_marker):
                continue
                
            # Extract data to check the type
            email_data = extract_data_from_email_file(file_path)
            
            if email_data and email_data.get("type") == priority_type:
                logger.info(f"Processing prioritized email file: {file_path}")
                
                # Create and send SMS
                success = create_sms_from_email_data(email_data, phone_number)
                
                if success:
                    # Mark as processed
                    with open(processed_marker, 'w') as f:
                        f.write(str(datetime.now()))
                    
                    processed_count += 1
    
    # Process remaining files
    for file_path in email_files:
        # Check if this file has been processed before
        processed_marker = file_path + ".processed"
        if os.path.exists(processed_marker):
            continue
            
        # If we're excluding a type, check first
        if exclude_type:
            email_data = extract_data_from_email_file(file_path)
            if email_data and email_data.get("type") == exclude_type:
                logger.info(f"Skipping excluded email type {exclude_type}: {file_path}")
                continue
        
        logger.info(f"Processing email file: {file_path}")
        
        # Extract data
        email_data = extract_data_from_email_file(file_path)
        
        if email_data:
            # Create and send SMS
            success = create_sms_from_email_data(email_data, phone_number)
            
            if success:
                # Mark as processed
                with open(processed_marker, 'w') as f:
                    f.write(str(datetime.now()))
                
                processed_count += 1
    
    logger.info(f"Email to SMS processing complete. Processed {processed_count} files.")
    return processed_count

# Replace the process_latest_due_now_email function with a more comprehensive one
def process_latest_email(email_type=None):
    """Find and process only the most recent email, optionally filtering by type
    
    Args:
        email_type (str, optional): If provided, only process emails of this type
                                   (e.g., "due_now", "missed")
    
    Returns:
        int: Number of emails processed (0 or 1)
    """
    # Look for all types of email files, not just scheduled ones
    email_files = glob.glob("last_*.html")
    
    latest_file = None
    latest_time = None
    
    # Find the most recent file
    for file_path in email_files:
        # Skip already processed files
        processed_marker = file_path + ".processed"
        if os.path.exists(processed_marker):
            continue
            
        file_time = os.path.getmtime(file_path)
        if latest_time is None or file_time > latest_time:
            latest_time = file_time
            latest_file = file_path
    
    if latest_file:
        logger.info(f"Found latest email file: {latest_file} (modified: {datetime.fromtimestamp(latest_time)})")
        
        # Extract data from the file
        email_data = extract_data_from_email_file(latest_file)
        
        if email_data:
            # If email_type is specified, only process that type
            if email_type and email_data.get("type") != email_type:
                logger.info(f"Skipping {email_data.get('type')} email (looking for {email_type})")
                return 0
                
            logger.info(f"Processing latest email of type: {email_data.get('type')}")
            
            # Get phone number from settings
            settings = load_settings()
            phone_number = os.getenv('RECIPIENT_PHONE_NUMBER')
            settings_sms = settings.get('sms_config', {})
            if settings_sms.get('phone_number'):
                phone_number = settings_sms.get('phone_number')
            
            # Create and send SMS
            success = create_sms_from_email_data(email_data, phone_number)
            
            if success:
                # Mark as processed
                with open(latest_file + ".processed", 'w') as f:
                    f.write(str(datetime.now()))
                return 1
            else:
                logger.error(f"Failed to send SMS for latest email: {latest_file}")
        else:
            logger.error(f"Failed to extract data from email file: {latest_file}")
    else:
        logger.info("No unprocessed email files found")
    
    return 0

# Add a new function to directly handle missed items without waiting for email generation
def process_missed_items(missed_items):
    """
    Directly process missed items to send SMS notifications
    
    Args:
        missed_items (list): List of missed item names
        
    Returns:
        bool: True if successful, False otherwise
    """
    if not missed_items:
        logger.warning("No missed items to process")
        return False
    
    logger.info(f"Processing {len(missed_items)} missed items directly")
    
    try:
        # Get phone number directly from environment
        phone_number = os.getenv('RECIPIENT_PHONE_NUMBER')
        logger.info(f"Using phone number from environment: {phone_number}")
        
        # If not in environment, try settings
        if not phone_number:
            settings = load_settings()
            settings_sms = settings.get('sms_config', {})
            phone_number = settings_sms.get('phone_number')
            logger.info(f"Using phone number from settings: {phone_number}")
        
        if not phone_number:
            logger.error("No recipient phone number found")
            return False
        
        # Format items for message
        items_text = ", ".join(missed_items)
        timestamp = datetime.now().strftime("%I:%M %p")
        message = f"MISSED ITEMS ALERT ({timestamp}): The following items were not detected: {items_text}. Please check immediately."
        
        logger.info(f"Sending missed items SMS to {phone_number}")
        logger.info(f"Message: {message}")
        
        # Send SMS
        success = send_sms(phone_number, message)
        
        if success:
            logger.info(f"Successfully sent SMS for missed items: {items_text}")
            # Write to a success file for tracking
            with open("last_successful_sms.txt", "w") as f:
                f.write(f"Time: {datetime.now()}\nItems: {items_text}\n")
        else:
            logger.error(f"Failed to send SMS for missed items: {items_text}")
            # Try one more time with a simplified message
            simple_message = f"ALERT: Items missed: {items_text}"
            logger.info("Trying again with simplified message")
            second_try = send_sms(phone_number, simple_message)
            if second_try:
                logger.info("Second attempt succeeded with simplified message")
                return True
        
        return success
    except Exception as e:
        logger.error(f"Error in process_missed_items: {str(e)}")
        # Try as a last resort with minimal processing
        try:
            simplified_items = ", ".join(missed_items[:3])  # Take first 3 items only
            if len(missed_items) > 3:
                simplified_items += "... and others"
            simple_message = f"ALERT: Items missed: {simplified_items}"
            
            # Get phone directly from environment
            direct_phone = os.getenv('RECIPIENT_PHONE_NUMBER')
            if direct_phone:
                # Use the Twilio Client directly
                account_sid = os.getenv('TWILIO_ACCOUNT_SID')
                auth_token = os.getenv('TWILIO_AUTH_TOKEN')
                twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
                
                if all([account_sid, auth_token, twilio_phone, direct_phone]):
                    direct_phone = format_phone_number(direct_phone)
                    twilio_phone = format_phone_number(twilio_phone)
                    
                    client = Client(account_sid, auth_token)
                    message = client.messages.create(
                        body=simple_message,
                        from_=twilio_phone,
                        to=direct_phone
                    )
                    logger.info(f"Last resort SMS sent with SID: {message.sid}")
                    return True
        except Exception as last_error:
            logger.error(f"Final attempt failed: {str(last_error)}")
        
        return False

# Add a test function to directly test SMS functionality
def test_sms_directly():
    """Test the SMS functionality directly with a test message"""
    try:
        logger.info("Starting direct SMS test")
        
        # Get test phone number - try environment first, then settings
        phone_number = os.getenv('RECIPIENT_PHONE_NUMBER')
        if not phone_number:
            settings = load_settings()
            settings_sms = settings.get('sms_config', {})
            phone_number = settings_sms.get('phone_number')
        
        if not phone_number:
            logger.error("No recipient phone number found for SMS test")
            return False
        
        # Create test message with timestamp
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        test_message = f"This is a test message from EchoMind SMS service at {timestamp}"
        
        # Send SMS
        success = send_sms(phone_number, test_message)
        
        if success:
            logger.info("Test SMS sent successfully")
        else:
            logger.error("Failed to send test SMS")
        
        return success
    except Exception as e:
        logger.error(f"Error in test_sms_directly: {str(e)}")
        return False

def send_notification_sms(to_phone, subject, body):
    """
    Send SMS notification with the same format as email.
    
    Args:
        to_phone (str): Recipient's phone number
        subject (str): Subject/title of the notification
        body (str): Main content of the notification
    """
    try:
        logger.info(f"Sending notification SMS to {to_phone}")
        
        # Format message to be similar to email
        message = f"{subject}\n\n{body}"
        
        # Send using existing send_sms function
        success = send_sms(to_phone, message)
        
        if success:
            logger.info(f"Notification SMS sent successfully to {to_phone}")
        else:
            logger.error(f"Failed to send notification SMS to {to_phone}")
        
        return success
    except Exception as e:
        logger.error(f"Error sending notification SMS: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("Starting Email to SMS service")
    
    # First, test the SMS functionality directly
    logger.info("Testing SMS functionality...")
    sms_test_result = test_sms_directly()
    logger.info(f"SMS test result: {'Success' if sms_test_result else 'Failed'}")
    
    if not sms_test_result:
        logger.error("SMS test failed. Check your Twilio credentials and phone numbers.")
        logger.error("Make sure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and RECIPIENT_PHONE_NUMBER are set correctly.")
        # Exit with error if SMS test fails
        import sys
        sys.exit(1)
    
    # If SMS test succeeds, continue with normal processing
    processed = process_latest_email()
    
    if processed > 0:
        logger.info(f"Processed latest email file")
    else:
        due_now_count = process_latest_email(email_type="due_now")
        if due_now_count > 0:
            logger.info(f"Processed latest due now email")
        else:
            process_count = process_email_files(priority_type="due_now")
            logger.info(f"Processed {process_count} email files")