from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
import os
import json
import traceback
from bson import ObjectId
from datetime import datetime, timedelta
from uuid import uuid4
import base64
import requests
from werkzeug.utils import secure_filename
import groq
from collections import defaultdict
from apscheduler.schedulers.background import BackgroundScheduler
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
import bcrypt
import re
import time
import math # Added for game analytics functions
from dotenv import load_dotenv # Added for loading environment variables
from twilio.rest import Client

from twilio.base.exceptions import TwilioRestException

# --- External Dependencies (REQUIRED for SOS functionality) ---
# Ensure you have 'location_handler.py' and 'send_email.py' in the same directory.
# These modules are imported by Sos.py and are essential for the SOS feature.
try:
    from location_handler import get_current_location
    from send_email import send_sos_email
except ImportError:
    print("WARNING: 'location_handler.py' or 'send_email.py' not found.")
    print("The SOS functionality will not work without these files.")
    # Provide dummy functions or raise an error if critical
    def get_current_location(browser_location, battery_percentage):
        print("Dummy get_current_location: External module not found.")
        return f"Unknown Location (Browser: {browser_location}, Battery: {battery_percentage}%)"
    def send_sos_email(recipient_name, recipient_email, user_name, location, timestamp):
        print(f"Dummy send_sos_email: External module not found. Would send to {recipient_email}")
        print(f"SOS Alert for {user_name} at {location} on {timestamp}")


# Load environment variables (from .env file if present)
load_dotenv()

# Custom JSON encoder to handle ObjectId and datetime objects
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

# Initialize Flask app
app = Flask(__name__)

# Configure CORS for all routes, combining settings from both original files
# Sos.py had more specific CORS settings including supports_credentials and Authorization header.
# We'll use these and ensure both 5173 and 5174 origins are allowed.
CORS(app, supports_credentials=True, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
app.json_encoder = MongoJSONEncoder

# Set ImgBB API key
os.environ["IMGBB_API_KEY"] = os.getenv("IMGBB_API_KEY", "ae2817b2ebddd8b0160555cc377b8ff9")

# Set Groq API key (you need to set this with your own key)
os.environ["GROQ_API_KEY"] = os.getenv("GROQ_API_KEY", "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")

# Initialize Groq client
groq_client = groq.Groq(api_key=os.getenv("GROq_API_KEY"))

# Connect to MongoDB
mongo_uri = os.getenv("MONGO_URI") or "mongodb+srv://bossutkarsh30:YOCczedaElKny6Dd@cluster0.gixba.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
try:
    client = MongoClient(mongo_uri)
    # Test the connection
    client.admin.command('ping')
    print("MongoDB connection successful!")
    db = client["alzheimers_db"]
    patients_collection = db["patient"]
    games_collection = db["games"]
    contacts_collection = db["contacts"]
    routines_collection = db["routines"]
    medication_reminders_collection = db["medications"]
    # Ensure email uniqueness index for patients collection
    patients_collection.create_index("email", unique=True)
except Exception as e:
    print(f"MongoDB connection error: {str(e)}")
    traceback.print_exc()

# Initialize the scheduler for routines and medication reminders
scheduler = BackgroundScheduler()
scheduler.start()

# === Helper Functions ===

# Helper function to send email notifications (from games.py)
def send_email(to_email, subject, body):
    """Send both email and SMS notifications"""
    try:
        # Send email
        email_address = os.getenv("EMAIL_ADDRESS") or "echomind.reminder@gmail.com"
        email_password = os.getenv("EMAIL_PASSWORD") or "amhd krsr pmnh cybq"

        msg = MIMEMultipart()
        msg['From'] = email_address
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(email_address, email_password)
            server.send_message(msg)
            print(f"Email sent to {to_email}")

        # Send SMS immediately after email
        recipient_phone = os.getenv('RECIPIENT_PHONE_NUMBER')
        if recipient_phone:
            send_sms_notification(recipient_phone, subject, body)
        else:
            print("No recipient phone number configured for SMS")

    except Exception as e:
        print(f"Error in send_email: {str(e)}")
        raise

def send_sms_notification(to_phone, subject, body):
    """Send SMS using Twilio with verified working configuration"""
    account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    auth_token = os.getenv('TWILIO_AUTH_TOKEN')
    twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
    
    if not all([account_sid, auth_token, twilio_phone, to_phone]):
        print("Error: Missing Twilio configuration")
        return False
    
    try:
        client = Client(account_sid, auth_token)
        # Combine subject and body for SMS
        sms_text = f"{subject}\n\n{body}"
        
        message = client.messages.create(
            body=sms_text,
            from_=twilio_phone,
            to=to_phone
        )
        print(f"SMS sent successfully with SID: {message.sid}")
        return True
    except TwilioRestException as e:
        print(f"Twilio Error: {str(e)}")
        return False
    except Exception as e:
        print(f"General Error: {str(e)}")
        return False

# Helper function to check and send medication reminders (from games.py)
def check_and_send_reminder(reminder):
    """Helper function to check if it's time to send a medication reminder"""
    try:
        current_time = datetime.now()
        scheduled_time = reminder['date_time']

        # Calculate time difference in seconds
        time_diff = abs((current_time - scheduled_time).total_seconds())

        # Check if within a small window (e.g., 10 seconds)
        if time_diff <= 10:
            send_email(
                reminder['email'],
                f"Medication Reminder: {reminder['name']}",
                f"Time to take your medication: {reminder['name']}\n"
                f"Dosage: {reminder['dosage']}\n"
                f"Instructions: {reminder['instruction']}"
            )
            return True
        return False
    except Exception as e:
        print(f"Error checking reminder: {str(e)}")
        return False

# Helper function to send missed medication reminder (from games.py)
def send_missed_medication_reminder(reminder):
    try:
        # Check if the medication has been marked as completed
        current_reminder = medication_reminders_collection.find_one({'_id': reminder['_id']})

        if current_reminder and current_reminder.get('status') == 'pending':
            # Send missed medication email
            send_email(
                reminder['email'],
                f"⚠️ Missed Medication Alert: {reminder['name']}",
                f"IMPORTANT: You have missed your scheduled medication:\n\n"
                f"Medication: {reminder['name']}\n"
                f"Dosage: {reminder['dosage']}\n"
                f"Instructions: {reminder['instruction']}\n\n"
                f"This medication was scheduled for: {reminder['date_time'].strftime('%Y-%m-%d %H:%M:%S')}\n\n"
                f"Please take your medication as soon as possible and consult your healthcare provider if needed."
            )

            # Update reminder status to missed
            medication_reminders_collection.update_one(
                {'_id': reminder['_id']},
                {'$set': {'status': 'missed'}}
            )

            print(f"Sent missed medication alert for reminder {reminder['_id']}")

    except Exception as e:
        print(f"Error sending missed medication reminder: {str(e)}")

# Helper function to schedule routine email notifications (from games.py)
def schedule_routine_email(routine, routine_id):
    try:
        if routine['frequency'] == 'hourly':
            trigger = 'interval'
            interval = {'hours': 1}
        elif routine['frequency'] == 'weekly':
            trigger = 'interval'
            interval = {'weeks': 1}
        elif routine['frequency'] == 'monthly':
            trigger = 'cron'
            interval = {'day': routine['scheduled_time'].day, 'hour': routine['scheduled_time'].hour, 'minute': routine['scheduled_time'].minute}
        else:
            print(f"Invalid frequency for routine {routine_id}: {routine['frequency']}. Not scheduling.")
            return

        scheduler.add_job(
            func=send_email,
            trigger=trigger,
            **interval,
            args=[
                routine['email'],
                f"Routine Reminder: {routine['title']}",
                f"It's time for your routine: {routine['title']}.\nDescription: {routine['description']}"
            ],
            id=routine_id
        )
    except Exception as e:
        print(f"Error scheduling routine email: {str(e)}")

# Helper function to generate summary from conversations (from games.py)
def generate_summary(conversations, person_name):
    try:
        # Format conversation data for the AI
        formatted_messages = []
        for message in conversations:
            speaker = "Known Person" if person_name else "Contact"
            formatted_messages.append({
                "text": message["text"],
                "speaker": speaker if message.get("from_contact", True) else "You",
                "timestamp": message["timestamp"]
            })

        # Create a prompt for summarization
        prompt = f"""
        Please analyze the following conversation between a patient and {person_name} and provide a comprehensive summary.

        Focus on:
        1. Main topics discussed
        2. Any important points, questions, or concerns raised
        3. Any actionable items or follow-ups mentioned
        4. The overall tone and nature of the conversation

        Format your response with the following sections:
        **Main Topics:** Summarize the key subjects discussed
        **Important Points:** List any significant information shared
        **Action Items:** Note any tasks, follow-ups, or commitments made
        **Relationship Context:** Provide insights about the relationship based on the conversation

        Here's the conversation:

        {json.dumps(formatted_messages, indent=2)}
        """

        # Call Groq API for summarization
        response = groq_client.chat.completions.create(
            model="llama3-70b-8192",  # Using Llama 3 70B model
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes conversations for patients with memory difficulties."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.3
        )

        # Extract the summary
        summary = response.choices[0].message.content
        return summary
    except Exception as e:
        print(f"Error generating summary: {str(e)}")
        traceback.print_exc()
        return "Unable to generate summary due to an error."

# Helper functions for validation (from Sos.py)
def is_valid_email(email):
    regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(regex, email)

def is_valid_phone(phone):
    regex = r'^\+?[0-9]{10,15}$'
    return re.match(regex, phone)

# === Routes from Sos.py ===

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json

    # Required fields
    required_fields = ['name', 'email', 'password', 'age', 'phone']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400

    if not is_valid_email(data['email']):
        return jsonify({'success': False, 'message': 'Invalid email format'}), 400

    if not is_valid_phone(data['phone']):
        return jsonify({'success': False, 'message': 'Invalid phone number format'}), 400

    try:
        if patients_collection.find_one({'email': data['email']}):
            return jsonify({'success': False, 'message': 'Email already registered'}), 409
    except Exception as e:
        print(f"Error checking for existing user: {str(e)}")
        return jsonify({'success': False, 'message': f'Database error during signup: {str(e)}'}), 500


    hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())
    user_id = str(uuid4())

    user = {
        '_id': user_id,
        'name': data['name'],
        'email': data['email'],
        'password': hashed_password.decode('utf-8'),
        'age': int(data['age']),
        'phone': data['phone'],
        'date': datetime.utcnow().isoformat()
    }

    try:
        patients_collection.insert_one(user)
        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'user_id': user_id
        }), 201
    except DuplicateKeyError:
        return jsonify({'success': False, 'message': 'Email already registered (duplicate key)'}), 409
    except Exception as e:
        print(f"Error during user registration: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Registration failed: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    if not data.get('email') or not data.get('password'):
        return jsonify({'success': False, 'message': 'Email and password are required'}), 400

    user = patients_collection.find_one({'email': data['email']})
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    if bcrypt.checkpw(data['password'].encode('utf-8'), user['password'].encode('utf-8')):
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {
                'user_id': user['_id'],
                'name': user['name'],
                'email': user['email'],
                'age': user['age'],
                'phone': user['phone']
            }
        }), 200
    else:
        return jsonify({'success': False, 'message': 'Invalid password'}), 401

@app.route('/api/sos', methods=['POST'])
def sos():
    try:
        user_data = request.json or {}
        user_id = user_data.get('user_id')
        user_name = user_data.get('name')

        user = patients_collection.find_one({'_id': user_id}) if user_id else None
        emergency_contacts = user.get('emergency_contacts', []) if user else [
            {"name": "Emergency Contact 1", "email": "rsubhashsrinivas@gmail.com"},
            {"name": "Emergency Contact 2", "email": "shashupreethims@gmail.com"},
            {"name": "Caregiver", "email": "bossutkarsh.30@gmail.com"}
        ]

        user_name = user.get('name', user_name) if user else user_name
        browser_location = user_data.get('location')
        battery_percentage = user_data.get('battery')
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")

        location = get_current_location(browser_location, battery_percentage)

        for contact in emergency_contacts:
            send_sos_email(
                recipient_name=contact["name"],
                recipient_email=contact["email"],
                user_name=user_name,
                location=location,
                timestamp=timestamp
            )

        return jsonify({
            "success": True,
            "status": "success",
            "message": "SOS alert sent successfully",
            "location": location,
            "timestamp": timestamp
        }), 200

    except Exception as e:
        print(f"Error processing SOS request: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "status": "error",
            "message": f"Failed to process SOS alert: {str(e)}"
        }), 500

# === Routes from games.py ===

# Route to get all patients
@app.route('/api/patients', methods=['GET'])
def get_patients():
    try:
        patients = list(patients_collection.find({}, {"password": 0}))
        return jsonify({"success": True, "patients": patients})
    except Exception as e:
        print(f"Error in get_patients: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Route to get patient by ID
@app.route('/api/patients/<patient_id>', methods=['GET'])
def get_patient(patient_id):
    try:
        # First try to find patient using the ID directly (for UUID)
        patient = patients_collection.find_one({"_id": patient_id}, {"password": 0})

        # If not found and ID looks like an ObjectId, try with ObjectId
        if not patient and len(patient_id) == 24 and all(c in '0123456789abcdefABCDEF' for c in patient_id):
            patient = patients_collection.find_one({"_id": ObjectId(patient_id)}, {"password": 0})

        if patient:
            return jsonify({"success": True, "patient": patient})
        return jsonify({"success": False, "error": "Patient not found"}), 404
    except Exception as e:
        print(f"Error in get_patient: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/analytics/patient/<patient_id>/games', methods=['GET'])
def get_patient_game_analytics(patient_id):
    try:
        # Get optional query parameters
        game_name = request.args.get('game', None)
        days = request.args.get('days', None)  # Number of days to look back
        limit = request.args.get('limit', None)  # Limit number of results

        # Build query - patient_id is stored as UUID string
        query = {"patient_id": patient_id}

        # Add game filter if specified
        if game_name:
            query["game_name"] = game_name

        # Add date filter if specified
        if days:
            try:
                days_ago = datetime.utcnow() - timedelta(days=int(days))
                query["timestamp"] = {"$gte": days_ago}
            except ValueError:
                return jsonify({"success": False, "error": "Invalid days parameter"}), 400

        # Create aggregation pipeline for better analytics
        pipeline = [
            {"$match": query},
            {"$sort": {"timestamp": 1}},  # Sort by timestamp ascending for graph data
        ]

        # Add limit if specified
        if limit:
            try:
                pipeline.append({"$limit": int(limit)})
            except ValueError:
                return jsonify({"success": False, "error": "Invalid limit parameter"}), 400

        # Execute aggregation
        scores = list(games_collection.aggregate(pipeline))

        # Group scores by game for easier graph construction
        games_data = {}
        total_games_played = len(scores)

        for score in scores:
            # Ensure _id is converted to string if it's an ObjectId from the aggregation result
            if '_id' in score and isinstance(score['_id'], ObjectId):
                score['_id'] = str(score['_id'])
            # Ensure patient_id is converted to string if it's an ObjectId (though it should be string from save)
            if 'patient_id' in score and isinstance(score['patient_id'], ObjectId):
                score['patient_id'] = str(score['patient_id'])

            game_name = score['game_name']
            if game_name not in games_data:
                games_data[game_name] = {
                    'game_name': game_name,
                    'scores': [],
                    'total_plays': 0,
                    'best_score': None,
                    'average_score': 0,
                    'latest_score': None,
                    'improvement_trend': None
                }

            # Format timestamp for frontend
            score['timestamp'] = score['timestamp'].isoformat() if isinstance(score['timestamp'], datetime) else score['timestamp']

            games_data[game_name]['scores'].append({
                'score': score['score'],
                'timestamp': score['timestamp'],
                'game_id': score['_id'] # Already converted to string above
            })
            games_data[game_name]['total_plays'] += 1

        # Calculate statistics for each game
        for game_name, game_data in games_data.items():
            scores_list = [s['score'] for s in game_data['scores']]

            # Calculate statistics
            game_data['best_score'] = max(scores_list) if scores_list else 0
            game_data['average_score'] = round(sum(scores_list) / len(scores_list), 2) if scores_list else 0
            game_data['latest_score'] = scores_list[-1] if scores_list else 0

            # Calculate improvement trend (comparing first half vs second half of games)
            if len(scores_list) >= 4:
                mid_point = len(scores_list) // 2
                first_half_avg = sum(scores_list[:mid_point]) / mid_point
                second_half_avg = sum(scores_list[mid_point:]) / (len(scores_list) - mid_point)

                improvement_threshold = 5  # 5% improvement threshold
                if second_half_avg > first_half_avg * (1 + improvement_threshold / 100):
                    game_data['improvement_trend'] = 'improving'
                elif second_half_avg < first_half_avg * (1 - improvement_threshold / 100):
                    game_data['improvement_trend'] = 'declining'
                else:
                    game_data['improvement_trend'] = 'stable'
            else:
                game_data['improvement_trend'] = 'insufficient_data'

        # Get patient info from the first score record (since patient_name is stored with each score)
        patient_info = None
        if scores:
            first_score = scores[0]
            patient_info = {
                "name": first_score.get("patient_name", first_score.get("user_name", "Unknown")),
                "patient_id": patient_id
            }

        # Calculate daily averages for trend analysis
        daily_scores = {}
        for score in scores:
            date_str = score['timestamp'][:10] if isinstance(score['timestamp'], str) else score['timestamp'].strftime('%Y-%m-%d')
            if date_str not in daily_scores:
                daily_scores[date_str] = []
            daily_scores[date_str].append(score['score'])

        daily_averages = []
        for date, scores_list in sorted(daily_scores.items()):
            daily_averages.append({
                "date": date,
                "average_score": round(sum(scores_list) / len(scores_list), 2),
                "games_played": len(scores_list)
            })

        return jsonify({
            "success": True,
            "patient_info": patient_info,
            "games_data": games_data,
            "daily_averages": daily_averages,
            "total_games_played": total_games_played,
            "games_available": list(games_data.keys()),
            "date_range": {
                "days_requested": days,
                "limit_requested": limit
            }
        })

    except Exception as e:
        print(f"Error in get_patient_game_analytics: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Route to get game analytics across all patients (for admin/overview)
@app.route('/api/analytics/games', methods=['GET'])
def get_all_games_analytics():
    try:
        # Get optional query parameters
        game_name = request.args.get('game', None)
        days = request.args.get('days', None)

        # Build base query
        query = {}

        # Add game filter if specified
        if game_name:
            query["game_name"] = game_name

        # Add date filter if specified
        if days:
            try:
                days_ago = datetime.utcnow() - timedelta(days=int(days))
                query["timestamp"] = {"$gte": days_ago}
            except ValueError:
                return jsonify({"success": False, "error": "Invalid days parameter"}), 400

        # Aggregation pipeline for comprehensive analytics
        pipeline = [
            {"$match": query},
            {
                "$group": {
                    "_id": {
                        "game_name": "$game_name",
                        "patient_id": "$patient_id"
                    },
                    "total_plays": {"$sum": 1},
                    "best_score": {"$max": "$score"},
                    "average_score": {"$avg": "$score"},
                    "latest_score": {"$last": "$score"},
                    "patient_name": {"$first": "$patient_name"},
                    "scores": {"$push": {"score": "$score", "timestamp": "$timestamp"}}
                }
            },
            {
                "$group": {
                    "_id": "$_id.game_name",
                    "total_players": {"$sum": 1},
                    "total_plays": {"$sum": "$total_plays"},
                    "overall_best_score": {"$max": "$best_score"},
                    "overall_average_score": {"$avg": "$average_score"},
                    "player_stats": {
                        "$push": {
                            "patient_id": "$_id.patient_id", # This could be an ObjectId
                            "patient_name": "$patient_name",
                            "plays": "$total_plays",
                            "best_score": "$best_score",
                            "average_score": "$average_score",
                            "latest_score": "$latest_score"
                        }
                    }
                }
            },
            {"$sort": {"total_plays": -1}}
        ]

        # Execute aggregation
        results = list(games_collection.aggregate(pipeline))

        # Format results
        analytics_data = {}
        total_games_played = 0
        total_unique_players = set()

        for result in results:
            # The _id here is game_name (string), so no conversion needed for result["_id"]
            game_name = result["_id"]
            analytics_data[game_name] = {
                "game_name": game_name,
                "total_players": result["total_players"],
                "total_plays": result["total_plays"],
                "overall_best_score": result["overall_best_score"],
                "overall_average_score": round(result["overall_average_score"], 2),
                "player_stats": [] # Initialize to populate with converted IDs
            }
            total_games_played += result["total_plays"] # Summing up total plays across all games

            for player_stat in result["player_stats"]:
                # Convert patient_id to string if it's an ObjectId
                if 'patient_id' in player_stat and isinstance(player_stat['patient_id'], ObjectId):
                    player_stat['patient_id'] = str(player_stat['patient_id'])
                analytics_data[game_name]['player_stats'].append(player_stat)

                total_unique_players.add(player_stat["patient_id"])

        return jsonify({
            "success": True,
            "analytics_data": analytics_data,
            "summary": {
                "total_games_played": total_games_played,
                "total_unique_players": len(total_unique_players),
                "games_available": list(analytics_data.keys()),
                "date_range_days": days
            }
        })

    except Exception as e:
        print(f"Error in get_all_games_analytics: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Route to get score progression for a specific game and patient (for detailed graphs)
@app.route('/api/analytics/patient/<patient_id>/game/<game_name>/progression', methods=['GET'])
def get_game_progression(patient_id, game_name):
    try:
        # Get optional query parameters
        days = request.args.get('days', None)
        limit = request.args.get('limit', None)

        # Build query - patient_id is UUID string
        query = {"patient_id": patient_id, "game_name": game_name}

        # Add date filter if specified
        if days:
            try:
                days_ago = datetime.utcnow() - timedelta(days=int(days))
                query["timestamp"] = {"$gte": days_ago}
            except ValueError:
                return jsonify({"success": False, "error": "Invalid days parameter"}), 400

        # Create aggregation pipeline
        pipeline = [
            {"$match": query},
            {"$sort": {"timestamp": 1}},
            {
                "$project": {
                    "score": 1,
                    "timestamp": 1,
                    "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                    "game_name": 1,
                    "patient_name": 1,
                    "_id": 1 # Include _id for potential conversion
                }
            }
        ]

        # Add limit if specified
        if limit:
            try:
                pipeline.append({"$limit": int(limit)})
            except ValueError:
                return jsonify({"success": False, "error": "Invalid limit parameter"}), 400

        # Execute query
        scores = list(games_collection.aggregate(pipeline))

        if not scores:
            return jsonify({
                "success": True,
                "progression_data": [],
                "daily_averages": [],
                "statistics": {
                    "total_plays": 0,
                    "best_score": 0,
                    "worst_score": 0,
                    "average_score": 0,
                    "improvement_rate": 0,
                    "consistency_score": 0
                },
                "game_name": game_name,
                "patient_id": patient_id
            })

        # Process scores for graph data
        progression_data = []
        daily_scores = {}

        for i, score in enumerate(scores):
            # Ensure _id is converted to string if it's an ObjectId
            if '_id' in score and isinstance(score['_id'], ObjectId):
                score['_id'] = str(score['_id'])

            # Format timestamp
            timestamp = score['timestamp'].isoformat() if isinstance(score['timestamp'], datetime) else score['timestamp']
            date = score['date']

            progression_data.append({
                "game_number": i + 1,
                "score": score['score'],
                "timestamp": timestamp,
                "date": date,
                "game_id": score['_id'] # Use the converted _id
            })

            # Group by date for daily averages
            if date not in daily_scores:
                daily_scores[date] = []
            daily_scores[date].append(score['score'])

        # Calculate daily averages
        daily_averages = []
        for date, scores_list in sorted(daily_scores.items()):
            daily_averages.append({
                "date": date,
                "average_score": round(sum(scores_list) / len(scores_list), 2),
                "games_played": len(scores_list)
            })

        # Calculate statistics
        score_values = [s['score'] for s in scores]
        total_plays = len(score_values)
        best_score = max(score_values)
        worst_score = min(score_values)
        average_score = round(sum(score_values) / total_plays, 2)

        # Calculate improvement rate (slope of trend line)
        if total_plays >= 2:
            x_values = list(range(1, total_plays + 1))
            n = len(x_values)
            sum_x = sum(x_values)
            sum_y = sum(score_values)
            sum_xy = sum(x * y for x, y in zip(x_values, score_values))
            sum_x2 = sum(x * x for x in x_values)

            denominator = n * sum_x2 - sum_x * sum_x
            if denominator != 0:
                improvement_rate = round((n * sum_xy - sum_x * sum_y) / denominator, 4)
            else:
                improvement_rate = 0
        else:
            improvement_rate = 0

        # Calculate consistency score (inverse of coefficient of variation)
        if average_score > 0:
            variance = sum((score - average_score) ** 2 for score in score_values) / total_plays
            std_deviation = math.sqrt(variance)
            coefficient_of_variation = std_deviation / average_score
            consistency_score = round(max(0, 1 - coefficient_of_variation), 3)
        else:
            consistency_score = 0

        return jsonify({
            "success": True,
            "progression_data": progression_data,
            "daily_averages": daily_averages,
            "statistics": {
                "total_plays": total_plays,
                "best_score": best_score,
                "worst_score": worst_score,
                "average_score": average_score,
                "improvement_rate": improvement_rate,
                "consistency_score": consistency_score
            },
            "game_name": game_name,
            "patient_id": patient_id,
            "patient_name": scores[0].get("patient_name", "Unknown") if scores else "Unknown",
            "date_range": {
                "days_requested": days,
                "limit_requested": limit
            }
        })

    except Exception as e:
        print(f"Error in get_game_progression: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Route to get leaderboard for a specific game
@app.route('/api/analytics/game/<game_name>/leaderboard', methods=['GET'])
def get_game_leaderboard(game_name):
    try:
        # Get optional query parameters
        days = request.args.get('days', None)
        limit = request.args.get('limit', 10)  # Default to top 10

        # Build base query
        query = {"game_name": game_name}

        # Add date filter if specified
        if days:
            try:
                days_ago = datetime.utcnow() - timedelta(days=int(days))
                query["timestamp"] = {"$gte": days_ago}
            except ValueError:
                return jsonify({"success": False, "error": "Invalid days parameter"}), 400

        # Aggregation pipeline for leaderboard
        pipeline = [
            {"$match": query},
            {
                "$group": {
                    "_id": "$patient_id",  # This will be patient_id, potentially ObjectId
                    "best_score": {"$max": "$score"},
                    "total_plays": {"$sum": 1},
                    "average_score": {"$avg": "$score"},
                    "latest_play": {"$max": "$timestamp"},
                    "patient_name": {"$first": "$patient_name"}
                }
            },
            {"$sort": {"best_score": -1}},  # Sort by best score descending
        ]

        # Safely convert limit to int
        try:
            limit_int = int(limit)
            pipeline.append({"$limit": limit_int})
        except ValueError:
            return jsonify({"success": False, "error": "Invalid limit parameter"}), 400


        # Execute aggregation
        leaderboard_data = list(games_collection.aggregate(pipeline))

        # Format data
        leaderboard = []
        for i, entry in enumerate(leaderboard_data):
            # Ensure _id (which is patient_id here) is converted to string
            patient_id_str = entry["_id"]
            if isinstance(patient_id_str, ObjectId):
                patient_id_str = str(patient_id_str)

            leaderboard.append({
                "rank": i + 1,
                "patient_id": patient_id_str,
                "patient_name": entry.get("patient_name", "Unknown"),
                "best_score": entry["best_score"],
                "total_plays": entry["total_plays"],
                "average_score": round(entry["average_score"], 2),
                "latest_play": entry["latest_play"].isoformat() if isinstance(entry["latest_play"], datetime) else entry["latest_play"]
            })

        return jsonify({
            "success": True,
            "game_name": game_name,
            "leaderboard": leaderboard,
            "total_entries": len(leaderboard),
            "date_range_days": days,
            "limit": limit
        })

    except Exception as e:
        print(f"Error in get_game_leaderboard: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Route to get all unique patients (for dropdown/selection)
@app.route('/api/analytics/patients', methods=['GET'])
def get_all_patients():
    try:
        # Get unique patients from game scores
        pipeline = [
            {
                "$group": {
                    "_id": "$patient_id", # This will be patient_id, potentially ObjectId
                    "patient_name": {"$first": "$patient_name"},
                    "user_name": {"$first": "$user_name"},
                    "total_games": {"$sum": 1},
                    "last_played": {"$max": "$timestamp"}
                }
            },
            {"$sort": {"patient_name": 1}}
        ]

        patients = list(games_collection.aggregate(pipeline))

        # Format patient data
        patient_list = []
        for patient in patients:
            # Ensure _id (patient_id) is converted to string
            patient_id_str = patient["_id"]
            if isinstance(patient_id_str, ObjectId):
                patient_id_str = str(patient_id_str)

            patient_list.append({
                "patient_id": patient_id_str,
                "patient_name": patient.get("patient_name", patient.get("user_name", "Unknown")),
                "total_games": patient["total_games"],
                "last_played": patient["last_played"].isoformat() if isinstance(patient["last_played"], datetime) else patient["last_played"]
            })

        return jsonify({
            "success": True,
            "patients": patient_list,
            "total_patients": len(patient_list)
        })

    except Exception as e:
        print(f"Error in get_all_patients: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Route to get all unique games (for dropdown/selection)
@app.route('/api/analytics/games/list', methods=['GET'])
def get_all_games():
    try:
        # Get game statistics
        pipeline = [
            {
                "$group": {
                    "_id": "$game_name", # This will be game_name (string)
                    "total_plays": {"$sum": 1},
                    "unique_players": {"$addToSet": "$patient_id"}, # patient_id could be ObjectId
                    "average_score": {"$avg": "$score"},
                    "max_score": {"$max": "$score"},
                    "last_played": {"$max": "$timestamp"}
                }
            },
            {"$sort": {"total_plays": -1}}
        ]

        game_stats = list(games_collection.aggregate(pipeline))

        # Format game data
        game_list = []
        for game in game_stats:
            # _id here is game_name (string), so no conversion needed for game["_id"]

            # Convert patient_ids within unique_players set to strings if they are ObjectIds
            unique_players_converted = set()
            for p_id in game["unique_players"]:
                if isinstance(p_id, ObjectId):
                    unique_players_converted.add(str(p_id))
                else:
                    unique_players_converted.add(p_id)

            game_list.append({
                "game_name": game["_id"],
                "total_plays": game["total_plays"],
                "unique_players": len(unique_players_converted), # Use the converted set's length
                "average_score": round(game["average_score"], 2),
                "max_score": game["max_score"],
                "last_played": game["last_played"].isoformat() if isinstance(game["last_played"], datetime) else game["last_played"]
            })

        return jsonify({
            "success": True,
            "games": game_list,
            "total_games": len(game_list)
        })

    except Exception as e:
        print(f"Error in get_all_games: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# Route to save game score to the Games collection
@app.route('/api/games', methods=['POST'])
def save_game_score():
    try:
        print("Received request to save game score")
        game_data = request.json
        print(f"Game data: {game_data}")

        required_fields = ['patient_id', 'game_name', 'score']

        for field in required_fields:
            if field not in game_data:
                return jsonify({"success": False, "error": f"Missing required field: {field}"}), 400

        # Add timestamp
        game_data['timestamp'] = datetime.utcnow()

        # Get patient information to store name
        patient_id = game_data['patient_id']
        patient_name = None

        # Try to find patient in the database to get their name
        try:
            # First try direct match (for UUID)
            patient = patients_collection.find_one({"_id": patient_id})

            # If not found and ID looks like an ObjectId, try with ObjectId
            if not patient and len(patient_id) == 24 and all(c in '0123456789abcdefABCDEF' for c in patient_id):
                patient = patients_collection.find_one({"_id": ObjectId(patient_id)})

            if patient and 'name' in patient:
                patient_name = patient['name']
        except Exception as e:
            print(f"Warning: Could not fetch patient name: {str(e)}")
            # Continue even if we couldn't get the name

        # Store patient name if available
        if patient_name:
            game_data['patient_name'] = patient_name

        # Keep patient_id as string - don't convert to ObjectId for UUID
        # This works with both UUID and ObjectId formats

        # Insert game score
        result = games_collection.insert_one(game_data)

        return jsonify({
            "success": True,
            "message": "Score saved successfully",
            "game_id": str(result.inserted_id)
        })
    except Exception as e:
        print(f"Error in save_game_score: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/games/<patient_id>', methods=['GET'])
def get_game_scores(patient_id):
    try:
        game = request.args.get('game', None)

        query = {"patient_id": patient_id}

        # If the patient_id looks like an ObjectId, try to query using both string and ObjectId
        # This provides backward compatibility but storing as string (UUID) is preferred for new data.
        if len(patient_id) == 24 and all(c in '0123456789abcdefABCDEF' for c in patient_id):
            try:
                object_id = ObjectId(patient_id)
                query = {"$or": [{"patient_id": patient_id}, {"patient_id": object_id}]}
            except Exception as e:
                # If ObjectId conversion fails, treat as a regular string ID
                print(f"Warning: Failed to convert patient_id to ObjectId: {e}")
                pass

        if game:
            if "$or" in query:
                # If there's already an $or for patient_id, wrap both conditions in an $and
                query = {"$and": [query, {"game_name": game}]}
            else:
                query["game_name"] = game

        raw_scores = games_collection.find(query).sort("timestamp", -1)
        scores = []
        for score in raw_scores:
            score['_id'] = str(score['_id'])  # ObjectId to string
            # Ensure patient_id is converted to string if it happens to be an ObjectId
            if 'patient_id' in score and isinstance(score['patient_id'], ObjectId):
                score['patient_id'] = str(score['patient_id'])  # ObjectId to string
            if 'timestamp' in score and isinstance(score['timestamp'], datetime):
                score['timestamp'] = score['timestamp'].isoformat()  # datetime to string
            scores.append(score)

        return jsonify({"success": True, "games": scores})
    except Exception as e:
        print(f"Error in get_game_scores: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    """Uploads an image to ImgBB via the backend."""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file provided'}), 400

        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No selected file'}), 400

        if file:
            imgbb_api_key = os.getenv("IMGBB_API_KEY")
            if not imgbb_api_key:
                return jsonify({'success': False, 'error': 'ImgBB API key not configured on backend'}), 500

            # ImgBB expects the image data as a base64 encoded string or multipart form data
            # Since we're forwarding a file, multipart is easier.
            files = {'image': (secure_filename(file.filename), file.read(), file.content_type)}
            data = {'key': imgbb_api_key}

            imgbb_response = requests.post("https://api.imgbb.com/1/upload", files=files, data=data)
            imgbb_response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)

            imgbb_data = imgbb_response.json()

            if imgbb_data['success']:
                return jsonify({'success': True, 'imageUrl': imgbb_data['data']['url']})
            else:
                return jsonify({'success': False, 'error': imgbb_data.get('error', {}).get('message', 'ImgBB upload failed')}), 500
    except requests.exceptions.RequestException as e:
        print(f"ImgBB API request error: {e}")
        return jsonify({'success': False, 'error': f"Error communicating with ImgBB: {e}"}), 500
    except Exception as e:
        print(f"Error in image upload: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# Get contacts for a user
@app.route('/api/contacts/<user_id>', methods=['GET'])
def get_contacts(user_id):
    """Get all contacts for a specific user"""
    try:
        # Find all contacts for the user
        contacts = list(contacts_collection.find({"user_id": user_id}))

        # Convert ObjectId to string for JSON serialization
        for contact in contacts:
            contact['_id'] = str(contact['_id'])

        return jsonify({
            'success': True,
            'contacts': contacts
        })

    except Exception as e:
        print(f"Error fetching contacts: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

# Add new contact
@app.route('/api/contacts', methods=['POST'])
def add_contact():
    """Add a new contact to your main backend system"""
    try:
        data = request.json
        print(f"Received contact data for /api/contacts: {data}")  # Debug log

        # Validate required fields
        if not data.get('name') or not data.get('user_id'):
            return jsonify({'success': False, 'error': 'Name and user_id are required'}), 400

        # Create contact document
        contact_doc = {
            'name': data['name'].strip(),
            'email': data.get('email', ''),
            'phone': data.get('phone', ''),
            'isEmergency': data.get('isEmergency', False),
            'photo_url': data.get('photo_url', ''),
            'user_id': data['user_id'],
            'user_name': data.get('user_name', 'Unknown'),
            'conversation_data': data.get('conversation_data', []),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        print(f"Inserting contact document into main collection: {contact_doc}")  # Debug log

        # Insert into database
        result = contacts_collection.insert_one(contact_doc)

        if result.inserted_id:
            print(f"Contact added successfully to main collection with ID: {result.inserted_id}")  # Debug log
            return jsonify({
                'success': True,
                'contact_id': str(result.inserted_id),
                'message': 'Contact added successfully to MongoDB'
            }), 201 # Return 201 for resource creation
        else:
            return jsonify({'success': False, 'error': 'Failed to add contact'}), 500

    except Exception as e:
        print(f"Error adding contact to main collection: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

# Update contact
@app.route('/api/contacts/<contact_id>', methods=['PUT'])
def update_contact():
    """Update an existing contact"""
    try:
        contact_id = request.view_args['contact_id'] # Get from view_args for consistency
        data = request.json
        print(f"Updating contact {contact_id} with data: {data}")  # Debug log

        # Validate ObjectId
        try:
            contact_object_id = ObjectId(contact_id)
        except:
            return jsonify({'success': False, 'error': 'Invalid contact ID'}), 400

        # Validate required fields
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Name is required'}), 400

        # Create update document
        update_doc = {
            'name': data['name'].strip(),
            'email': data.get('email', ''),
            'phone': data.get('phone', ''),
            'isEmergency': data.get('isEmergency', False),
            'updated_at': datetime.utcnow()
        }

        # Only update photo_url if provided in the update request
        if 'photo_url' in data and data['photo_url']:
            update_doc['photo_url'] = data['photo_url']

        # Only update conversation_data if provided
        if 'conversation_data' in data:
            update_doc['conversation_data'] = data['conversation_data']

        # Update in database
        result = contacts_collection.update_one(
            {'_id': contact_object_id},
            {'$set': update_doc}
        )

        if result.matched_count > 0:
            print(f"Contact {contact_id} updated successfully")  # Debug log
            return jsonify({
                'success': True,
                'message': 'Contact updated successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'Contact not found'}), 404

    except Exception as e:
        print(f"Error updating contact: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

# Delete contact
@app.route('/api/contacts/<contact_id>', methods=['DELETE'])
def delete_contact(contact_id):
    """Delete a contact"""
    try:
        print(f"Deleting contact: {contact_id}")  # Debug log

        # Validate ObjectId
        try:
            contact_object_id = ObjectId(contact_id)
        except:
            return jsonify({'success': False, 'error': 'Invalid contact ID'}), 400

        # Delete from database
        result = contacts_collection.delete_one({'_id': contact_object_id})

        if result.deleted_count > 0:
            print(f"Contact {contact_id} deleted successfully")  # Debug log
            return jsonify({
                'success': True,
                'message': 'Contact deleted successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'Contact not found'}), 404

    except Exception as e:
        print(f"Error deleting contact: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# New route to get known persons (contacts) for a patient
@app.route('/api/known-persons/<patient_id>', methods=['GET'])
def get_known_persons(patient_id):
    try:
        contacts = list(contacts_collection.find({"user_id": patient_id}))
        # Transform contacts to known_persons format
        known_persons = []
        for contact in contacts:
            known_persons.append({
                "known_person_id": str(contact["_id"]), # Ensure ObjectId is converted
                "name": contact["name"],
                "photo_url": contact.get("photo_url", ""),
                "isEmergency": contact.get("isEmergency", False)
            })

        return jsonify({"success": True, "known_persons": known_persons})
    except Exception as e:
        print(f"Error in get_known_persons: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# New route to summarize conversation for a specific date
@app.route('/api/summarize-conversation', methods=['GET'])
def summarize_conversation():
    try:
        patient_id = request.args.get('patient_id')
        known_person_id = request.args.get('known_person_id')
        date_str = request.args.get('date')

        if not patient_id or not known_person_id or not date_str:
            return jsonify({
                "success": False,
                "error": "Missing required parameters: patient_id, known_person_id, and date"
            }), 400

        # Parse the date
        date = datetime.strptime(date_str, '%Y-%m-%d')
        next_day = date + timedelta(days=1)

        # Get the contact document
        contact = contacts_collection.find_one({"_id": known_person_id, "user_id": patient_id})

        if not contact:
            # Try with ObjectId if ID looks like one
            if len(known_person_id) == 24 and all(c in '0123456789abcdefABCDEF' for c in known_person_id):
                contact = contacts_collection.find_one({"_id": ObjectId(known_person_id), "user_id": patient_id})

        if not contact:
            return jsonify({
                "success": False,
                "summary": "This contact does not exist or doesn't belong to the patient."
            })

        # Filter messages for the specified date
        if 'conversation_data' not in contact or not contact['conversation_data']:
            return jsonify({
                "success": False,
                "summary": "No conversation data found for this contact."
            })

        # Filter messages for the specified date
        date_messages = []
        for message in contact['conversation_data']:
            try:
                message_time = datetime.fromisoformat(message['timestamp'].replace('Z', '+00:00'))
                if date <= message_time < next_day:
                    date_messages.append(message)
            except (ValueError, TypeError) as e:
                print(f"Error parsing message timestamp: {e}")
                continue

        if not date_messages:
            return jsonify({
                "success": False,
                "summary": f"No conversation found for {date_str}.",
                "conversation_count": 0,
                "conversation_length": 0,
                "date": date_str,
                "original_messages": []
            })

        # Format messages for display
        formatted_messages = []
        total_length = 0
        for message in date_messages:
            speaker = contact['name'] if message.get('from_contact', True) else "You"
            formatted_messages.append({
                "text": message["text"],
                "speaker": speaker,
                "timestamp": message["timestamp"]
            })
            total_length += len(message["text"])

        # Generate summary using Groq
        summary = generate_summary(date_messages, contact['name'])

        return jsonify({
            "success": True,
            "summary": summary,
            "conversation_count": len(date_messages),
            "conversation_length": total_length,
            "date": date_str,
            "original_messages": formatted_messages
        })
    except Exception as e:
        print(f"Error in summarize_conversation: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# New route to summarize all conversations with a known person
@app.route('/api/summarize-all-conversations', methods=['GET'])
def summarize_all_conversations():
    try:
        patient_id = request.args.get('patient_id')
        known_person_id = request.args.get('known_person_id')

        if not patient_id or not known_person_id:
            return jsonify({
                "success": False,
                "error": "Missing required parameters: patient_id and known_person_id"
            }), 400

        # Get the contact document
        contact = contacts_collection.find_one({"_id": known_person_id, "user_id": patient_id})

        if not contact:
            # Try with ObjectId if ID looks like one
            if len(known_person_id) == 24 and all(c in '0123456789abcdefABCDEF' for c in known_person_id):
                contact = contacts_collection.find_one({"_id": ObjectId(known_person_id), "user_id": patient_id})

        if not contact:
            return jsonify({
                "success": False,
                "summary": "This contact does not exist or doesn't belong to the patient."
            })

        # Check if conversation data exists
        if 'conversation_data' not in contact or not contact['conversation_data']:
            return jsonify({
                "success": False,
                "summary": "No conversation data found for this contact."
            })

        # Format messages for display and organize by date
        messages_by_date = defaultdict(list)
        conversation_dates = set()
        total_length = 0

        for message in contact['conversation_data']:
            try:
                message_time = datetime.fromisoformat(message['timestamp'].replace('Z', '+00:00'))
                date_str = message_time.strftime('%Y-%m-%d')

                speaker = contact['name'] if message.get('from_contact', True) else "You"
                formatted_message = {
                    "text": message["text"],
                    "speaker": speaker,
                    "timestamp": message["timestamp"]
                }

                messages_by_date[date_str].append(formatted_message)
                conversation_dates.add(date_str)
                total_length += len(message["text"])
            except (ValueError, TypeError) as e:
                print(f"Error parsing message timestamp: {e}")
                continue

        if not messages_by_date:
            return jsonify({
                "success": False,
                "summary": "No valid conversation data found for analysis.",
                "conversation_count": 0,
                "conversation_length": 0
            })

        # Sort dates in reverse chronological order
        conversation_dates = sorted(list(conversation_dates), reverse=True)

        # Generate a comprehensive summary using Groq
        summary = generate_summary(contact['conversation_data'], contact['name'])

        return jsonify({
            "success": True,
            "summary": summary,
            "conversation_count": len(contact['conversation_data']),
            "conversation_length": total_length,
            "messages_by_date": messages_by_date,
            "conversation_dates": conversation_dates
        })
    except Exception as e:
        print(f"Error in summarize_all_conversations: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Route to create a medication reminder
@app.route('/api/medication-reminders', methods=['POST'])
def create_medication_reminder():
    try:
        data = request.json
        required_fields = ['name', 'dosage', 'instruction', 'date_time', 'frequency', 'email']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400

        # Parse and validate the reminder date-time using system time
        reminder_time = datetime.strptime(data['date_time'], '%Y-%m-%d %H:%M:%S')
        current_time = datetime.now()

        # Check if reminder time is within valid range
        if reminder_time < current_time:
            return jsonify({'success': False, 'message': 'Reminder date-time must be in the future'}), 400

        # Save the reminder to the database with status field
        reminder = {
            'name': data['name'],
            'dosage': data['dosage'],
            'instruction': data['instruction'],
            'date_time': reminder_time,
            'frequency': data['frequency'],
            'email': data['email'],
            'created_at': current_time,
            'status': 'pending',  # Add status field
            'completed_at': None  # Add completed_at field
        }
        result = medication_reminders_collection.insert_one(reminder)

        # Schedule both the initial reminder and the missed medication check
        reminder_id = str(result.inserted_id)

        # Schedule initial reminder check to run frequently (e.g., every 10 seconds)
        # This will trigger send_email when the scheduled_time is met
        scheduler.add_job(
            func=check_and_send_reminder,
            trigger='interval',
            seconds=10, # Check every 10 seconds
            args=[reminder],
            id=f"{reminder_id}_check"
        )

        # Schedule missed medication reminder to run once, 30 seconds after the scheduled_time
        scheduler.add_job(
            func=send_missed_medication_reminder,
            trigger='date',
            run_date=reminder_time + timedelta(seconds=30),
            args=[reminder],
            id=f"{reminder_id}_missed"
        )

        print(f"Scheduled reminder check job: {reminder_id}_check for {reminder_time}")
        print(f"Scheduled missed reminder job: {reminder_id}_missed for {reminder_time + timedelta(seconds=30)}")

        return jsonify({
            'success': True,
            'message': 'Medication reminder created successfully',
            'reminder_id': reminder_id
        }), 201

    except Exception as e:
        print(f"Error creating medication reminder: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Failed to create medication reminder: {str(e)}'}), 500

# Route to update a medication reminder
@app.route('/api/medication-reminders/<reminder_id>', methods=['PUT'])
def update_medication_reminder(reminder_id):
    try:
        data = request.json
        update_fields = {}
        if 'name' in data:
            update_fields['name'] = data['name']
        if 'dosage' in data:
            update_fields['dosage'] = data['dosage']
        if 'instruction' in data:
            update_fields['instruction'] = data['instruction']
        if 'date_time' in data:
            reminder_time = datetime.strptime(data['date_time'], '%Y-%m-%d %H:%M:%S')
            if reminder_time < datetime.utcnow():
                return jsonify({'success': False, 'message': 'Reminder date-time must be in the future'}), 400
            update_fields['date_time'] = reminder_time
        if 'frequency' in data:
            if data['frequency'] not in ['daily', 'weekly', 'monthly']:
                return jsonify({'success': False, 'message': 'Invalid frequency. Choose from daily, weekly, or monthly'}), 400
            update_fields['frequency'] = data['frequency']
        if 'email' in data:
            update_fields['email'] = data['email']

        # Update the reminder in the database
        result = medication_reminders_collection.update_one({'_id': ObjectId(reminder_id)}, {'$set': update_fields})
        if result.matched_count == 0:
            return jsonify({'success': False, 'message': 'Reminder not found'}), 404

        # Reschedule the email notification if date_time or frequency is updated
        if 'date_time' in update_fields or 'frequency' in update_fields:
            # Remove existing jobs for this reminder
            try:
                scheduler.remove_job(f"{reminder_id}_check")
            except Exception as e:
                print(f"Warning: Could not remove check job {reminder_id}_check: {e}")
            try:
                scheduler.remove_job(f"{reminder_id}_missed")
            except Exception as e:
                print(f"Warning: Could not remove missed job {reminder_id}_missed: {e}")

            # Fetch the updated reminder to ensure correct data for rescheduling
            updated_reminder = medication_reminders_collection.find_one({'_id': ObjectId(reminder_id)})
            if updated_reminder:
                # Reschedule initial reminder check
                scheduler.add_job(
                    func=check_and_send_reminder,
                    trigger='interval',
                    seconds=10,
                    args=[updated_reminder],
                    id=f"{reminder_id}_check"
                )
                # Reschedule missed medication reminder
                scheduler.add_job(
                    func=send_missed_medication_reminder,
                    trigger='date',
                    run_date=updated_reminder['date_time'] + timedelta(seconds=30),
                    args=[updated_reminder],
                    id=f"{reminder_id}_missed"
                )
                print(f"Rescheduled reminder jobs for {reminder_id}")
            else:
                print(f"Could not find updated reminder {reminder_id} to reschedule.")


        return jsonify({'success': True, 'message': 'Medication reminder updated successfully'}), 200
    except Exception as e:
        print(f"Error updating medication reminder: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Failed to update medication reminder: {str(e)}'}), 500

# Route to delete a medication reminder
@app.route('/api/medication-reminders/<reminder_id>', methods=['DELETE'])
def delete_medication_reminder(reminder_id):
    try:
        # Delete the reminder from the database
        result = medication_reminders_collection.delete_one({'_id': ObjectId(reminder_id)})
        if result.deleted_count == 0:
            return jsonify({'success': False, 'message': 'Reminder not found'}), 404

        # Remove the scheduled jobs
        try:
            scheduler.remove_job(f"{reminder_id}_check")
        except Exception as e:
            print(f"Warning: Could not remove check job {reminder_id}_check: {e}")
        try:
            scheduler.remove_job(f"{reminder_id}_missed")
        except Exception as e:
            print(f"Warning: Could not remove missed job {reminder_id}_missed: {e}")


        return jsonify({'success': True, 'message': 'Medication reminder deleted successfully'}), 200
    except Exception as e:
        print(f"Error deleting medication reminder: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Failed to delete medication reminder: {str(e)}'}), 500

# Route to mark medication as taken
@app.route('/api/medication-reminders/<reminder_id>/complete', methods=['POST'])
def mark_medication_taken(reminder_id):
    try:
        # Update the reminder status
        result = medication_reminders_collection.update_one(
            {'_id': ObjectId(reminder_id)},
            {
                '$set': {
                    'status': 'completed',
                    'completed_at': datetime.now()
                }
            }
        )

        if result.matched_count == 0:
            return jsonify({'success': False, 'message': 'Reminder not found'}), 404

        # Remove the scheduled missed medication job since it's been taken
        try:
            scheduler.remove_job(f"{reminder_id}_missed")
        except Exception as e:
            print(f"Warning: Could not remove missed medication job: {str(e)}")

        return jsonify({
            'success': True,
            'message': 'Medication marked as taken successfully'
        })

    except Exception as e:
        print(f"Error marking medication as taken: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

# Update the get_medication_reminders route to include status
@app.route('/api/medication-reminders', methods=['GET'])
def get_medication_reminders():
    try:
        reminders = list(medication_reminders_collection.find({}, {
            "_id": 1,
            "name": 1,
            "dosage": 1,
            "instruction": 1,
            "date_time": 1,
            "frequency": 1,
            "email": 1,
            "status": 1,
            "completed_at": 1
        }))

        # Convert ObjectId to string and adjust times to local time
        for reminder in reminders:
            reminder["_id"] = str(reminder["_id"])
            if reminder.get("date_time"):
                reminder["date_time"] = reminder["date_time"].strftime('%Y-%m-%d %H:%M:%S')
            if reminder.get("completed_at"):
                reminder["completed_at"] = reminder["completed_at"].strftime('%Y-%m-%d %H:%M:%S')

        return jsonify({"success": True, "reminders": reminders}), 200
    except Exception as e:
        print(f"Error fetching medication reminders: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "message": f"Failed to fetch medication reminders: {str(e)}"}), 500

# Route to create a routine
@app.route('/api/routines', methods=['POST'])
def create_routine():
    try:
        data = request.json
        required_fields = ['title', 'description', 'scheduled_time', 'patient_name', 'frequency', 'email']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400

        # Parse and validate the scheduled_time
        scheduled_time = datetime.strptime(data['scheduled_time'], '%Y-%m-%d %H:%M:%S')
        if scheduled_time < datetime.utcnow():
            return jsonify({'success': False, 'message': 'Scheduled time must be in the future'}), 400

        # Validate frequency
        if data['frequency'] not in ['hourly', 'weekly', 'monthly']:
            return jsonify({'success': False, 'message': 'Invalid frequency. Choose from hourly, weekly, or monthly'}), 400

        # Save the routine to the database
        routine = {
            'title': data['title'],
            'description': data['description'],
            'scheduled_time': scheduled_time,
            'patient_name': data['patient_name'],
            'created_at': datetime.utcnow(),
            'frequency': data['frequency'],
            'email': data['email']
        }
        result = routines_collection.insert_one(routine)

        # Schedule email notifications
        schedule_routine_email(routine, str(result.inserted_id))

        # Send confirmation email
        send_email(
            data['email'],
            f"Routine Created: {data['title']}",
            f"Your routine '{data['title']}' has been created and scheduled for {scheduled_time}."
        )

        return jsonify({'success': True, 'message': 'Routine created successfully', 'routine_id': str(result.inserted_id)}), 201
    except Exception as e:
        print(f"Error creating routine: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Failed to create routine: {str(e)}'}), 500

# Route to get all routines
@app.route('/api/routines', methods=['GET'])
def get_routines():
    try:
        routines = list(routines_collection.find({}, {"_id": 1, "title": 1, "description": 1, "scheduled_time": 1, "patient_name": 1, "frequency": 1, "email": 1, "created_at": 1}))
        for routine in routines:
            routine["_id"] = str(routine["_id"])  # Convert ObjectId to string
            if routine.get("scheduled_time"):
                routine["scheduled_time"] = routine["scheduled_time"].strftime('%Y-%m-%d %H:%M:%S')
            if routine.get("created_at"):
                routine["created_at"] = routine["created_at"].strftime('%Y-%m-%d %H:%M:%S')
        return jsonify({'success': True, 'routines': routines}), 200
    except Exception as e:
        print(f"Error fetching routines: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Failed to fetch routines: {str(e)}'}), 500

# Route to update a routine
@app.route('/api/routines/<routine_id>', methods=['PUT'])
def update_routine(routine_id):
    try:
        data = request.json
        update_fields = {}
        if 'title' in data:
            update_fields['title'] = data['title']
        if 'description' in data:
            update_fields['description'] = data['description']
        if 'scheduled_time' in data:
            scheduled_time = datetime.strptime(data['scheduled_time'], '%Y-%m-%d %H:%M:%S')
            if scheduled_time < datetime.utcnow():
                return jsonify({'success': False, 'message': 'Scheduled time must be in the future'}), 400
            update_fields['scheduled_time'] = scheduled_time
        if 'frequency' in data:
            if data['frequency'] not in ['hourly', 'weekly', 'monthly']:
                return jsonify({'success': False, 'message': 'Invalid frequency. Choose from hourly, weekly, or monthly'}), 400
            update_fields['frequency'] = data['frequency']
        if 'patient_name' in data:
            update_fields['patient_name'] = data['patient_name']
        if 'email' in data:
            update_fields['email'] = data['email']

        # Update the routine in the database
        result = routines_collection.update_one({'_id': ObjectId(routine_id)}, {'$set': update_fields})
        if result.matched_count == 0:
            return jsonify({'success': False, 'message': 'Routine not found'}), 404

        # Reschedule email notifications if necessary
        if 'scheduled_time' in update_fields or 'frequency' in update_fields:
            try:
                scheduler.remove_job(routine_id)
            except Exception as e:
                print(f"Warning: Could not remove existing job {routine_id}: {e}")

            updated_routine = routines_collection.find_one({'_id': ObjectId(routine_id)})
            if updated_routine:
                schedule_routine_email(updated_routine, routine_id)
           
            else:
                print(f"Could not find updated routine {routine_id} to reschedule.")


        return jsonify({'success': True, 'message': 'Routine updated successfully'}), 200
    except Exception as e:
        print(f"Error updating routine: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Failed to update routine: {str(e)}'}), 500

# Route to delete a routine
@app.route('/api/routines/<routine_id>', methods=['DELETE'])
def delete_routine(routine_id):
    try:
        # Delete the routine from the database
        result = routines_collection.delete_one({'_id': ObjectId(routine_id)})
        if result.deleted_count == 0:
            return jsonify({'success': False, 'message': 'Routine not found'}), 404

        # Remove the scheduled job
        try:
            scheduler.remove_job(routine_id)
        except Exception as e:
            print(f"Warning: Could not remove job {routine_id}: {e}")


        return jsonify({'success': True, 'message': 'Routine deleted successfully'}), 200
    except Exception as e:
        print(f"Error deleting routine: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Failed to delete routine: {str(e)}'}), 500

if __name__ == '__main__':
    try:
        print("Starting Flask server on http://localhost:5000")
        app.run(host='0.0.0.0', port=5000, debug=True)
    except Exception as e:
        print(f"Server failed to start: {str(e)}")
        traceback.print_exc()
