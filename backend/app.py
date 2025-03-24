from flask import Flask, jsonify, request
from flask_cors import CORS
import bcrypt
import jwt
import datetime
import uuid
import requests
import os
from functools import wraps
from dotenv import load_dotenv
from dateutil.parser import parse

# MongoDB imports
import mongoengine as me
from mongoengine import Document, StringField, IntField, DateTimeField, connect, disconnect_all, DoesNotExist, ListField
from pymongo import MongoClient

# Initialize Flask app
app = Flask(__name__)

# Configure CORS properly to accept requests from your React app
# Updated to include all possible origins including the forwarded URL
CORS(app, 
     resources={r"/*": {
         "origins": ["http://localhost:5173", 
                    "ADD_YOUR_URL_HERE"],
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization", "x-auth-token"]
     }},
     supports_credentials=True)

# Debug logging for CORS
@app.after_request
def after_request(response):
    print(f"Request: {request.method} {request.path} - Response: {response.status_code}")
    print(f"Request Headers: Origin={request.headers.get('Origin')}")
    return response

# Load environment variables
load_dotenv()

# Groq API Key
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("Warning: GROQ_API_KEY not found in environment variables")

# Configure MongoDB - Make sure this is set before initializing connections
mongo_uri = "YOUR_MONGODB_URI"

# Connect to MongoDB using MongoEngine for document models
me.connect(db="MONGDB_DB_NAME", host=mongo_uri)

# Connect to MongoDB using PyMongo client for conversation collection
client = MongoClient(mongo_uri)
db = client["MONGODB_DB_NAME"]
conversation_collection = db["conversation"]

# Define Document Models
class Patient(Document):
    user_id = StringField(primary_key=True, default=lambda: str(uuid.uuid4()))
    name = StringField(required=True)
    email = StringField(required=True, unique=True)
    password = StringField(required=True)
    age = IntField(required=True)
    date = DateTimeField(default=datetime.datetime.now)

    meta = {'collection': 'patient'}

    def to_json(self):
        return {
            '_id': self.user_id,
            'name': self.name,
            'email': self.email,
            'age': self.age,
            'date': self.date
        }

# Define KnownPerson model
class KnownPerson(Document):
    name = StringField()
    known_person_id = StringField()
    patient_id = StringField()
    image_path = StringField()
    face_encoding = ListField()
    
    meta = {'collection': 'known_person'}
    
    def to_json(self):
        return {
            'id': str(self.id),
            'patient_id': self.patient_id,
            'name': self.name,
            'known_person_id': self.known_person_id
        }

# JWT token verification middleware
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('x-auth-token')

        if not token:
            return jsonify({'message': 'No token, authorization denied'}), 401

        try:
            data = jwt.decode(token, "patientSecretKey123", algorithms=["HS256"])
            current_user_id = data['user']['id']
        except:
            return jsonify({'message': 'Token is not valid'}), 401

        return f(current_user_id, *args, **kwargs)

    return decorated

# Groq API Functions
def summarize_conversation(conversation_text):
    """Creates a concise conversation summary using Groq's current models."""
    try:
        if not conversation_text or len(conversation_text.strip()) < 10:
            return "Not enough conversation data to summarize."

        print(f"Creating concise summary (length: {len(conversation_text)} characters)...")

        # Check if Groq API key is available
        if not GROQ_API_KEY:
            return "Groq API key not configured. Cannot generate summary."

        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }

        # Updated to use a current Groq model (as of March 2025)
        payload = {
            "model": "llama3-70b-8192",
            "messages": [
                {
                    "role": "system",
                    "content": "You are an AI assistant that creates brief, personal summaries of conversations."
                },
                {
                    "role": "user",
                    "content": f"Summarize this conversation , keep it humble\n\n{conversation_text}\n\nKeep it detailed and highlight:\n1. Main topic and key points\n2. Any specific details or numbers mentioned\n3. mention the names mentioned\n5.Numbers mentioned.\n 5. No bad words should be mentioned"
                }
            ],
            "temperature": 0.3,
            "max_tokens": 300,
            "top_p": 0.8,
            "stream": False
        }

        print("Sending request to Groq API...")
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        # Debug information
        print(f"API Response Status: {response.status_code}")
        
        if response.status_code != 200:
            try:
                error_details = response.json()
                print(f"API Error Details: {error_details}")
            except ValueError:
                print(f"API Error Response: {response.text}")
            return f"Failed to generate summary. Status code: {response.status_code}"
            
        result = response.json()
        if "choices" in result and result["choices"]:
            summary_text = result["choices"][0].get("message", {}).get("content", "")
            if summary_text:
                return summary_text.strip()
        
        return "Could not generate summary from API response."
            
    except requests.exceptions.RequestException as e:
        print(f"API Request Error: {str(e)}")
        return f"Failed to get summary from API: {str(e)}"
    except Exception as e:
        print(f"Error in summarize_conversation: {str(e)}")
        return f"Summary generation failed: {str(e)}"

def test_groq_api():
    """Test connection to Groq API"""
    # Skip test if API key is not available
    if not GROQ_API_KEY:
        print("Warning: GROQ_API_KEY not found, skipping API test")
        return False
        
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    test_payload = {
        "model": "llama3-70b-8192",
        "messages": [{"role": "user", "content": "Test message"}]
    }

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            json=test_payload,
            headers=headers,
            timeout=10
        )

        print(f"Test API Status: {response.status_code}")
        if response.status_code != 200:
            try:
                error_details = response.json()
                print(f"Test API Error Details: {error_details}")
            except ValueError:
                print(f"Test API Error Response: {response.text}")
            return False
        return True

    except Exception as e:
        print(f"Test API Error: {e}")
        return False

# Basic route for testing
@app.route('/', methods=['GET'])
def home():
    return "API Running"

# Add OPTIONS methods for all routes to handle preflight requests
@app.route('/', methods=['OPTIONS'])
def home_options():
    return "", 200

@app.route('/api/test', methods=['OPTIONS'])
def test_db_options():
    return "", 200

@app.route('/api/auth/register', methods=['OPTIONS'])
def register_options():
    return "", 200

@app.route('/api/auth/login', methods=['OPTIONS'])
def login_options():
    return "", 200

@app.route('/api/auth/user', methods=['OPTIONS'])
def get_user_options():
    return "", 200

@app.route('/api/update-known-persons', methods=['OPTIONS'])
def update_known_persons_options():
    return "", 200

@app.route('/api/known-person-ids/<patient_id>', methods=['OPTIONS'])
def get_known_person_ids_options(patient_id):
    return "", 200

@app.route('/api/known-persons/<patient_id>', methods=['OPTIONS'])
def get_known_persons_options(patient_id):
    return "", 200

@app.route('/api/save-conversation', methods=['OPTIONS'])
def save_conversation_options():
    return "", 200

@app.route('/api/summarize-all-conversations', methods=['OPTIONS'])
def summarize_all_conversations_options():
    return "", 200

@app.route('/api/summarize-conversation', methods=['OPTIONS'])
def summarize_conversation_options():
    return "", 200

# Add a route to test MongoDB connection
@app.route('/api/test', methods=['GET'])
def test_db():
    try:
        # Check if we can access the database
        db_names = connect(host=mongo_uri).database_names()
        return jsonify({
            'status': 'success',
            'message': 'MongoDB connection successful',
            'databases': db_names
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'MongoDB connection failed: {str(e)}'
        }), 500

# Register route
@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        # Log that we received a request
        print("Register endpoint hit with data:", request.get_json())

        data = request.get_json()

        # Validate required fields
        required_fields = ['name', 'email', 'password', 'age']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'message': f'Missing required field: {field}'}), 400

        # Check if user exists
        try:
            existing_user = Patient.objects(email=data['email']).first()
            if existing_user:
                return jsonify({'message': 'User already exists with this email'}), 400
        except Exception as e:
            print(f"Error checking existing user: {str(e)}")
            return jsonify({'message': f'Database error: {str(e)}'}), 500

        # Hash the password
        hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())

        # Create new user
        try:
            new_user = Patient(
                name=data['name'],
                email=data['email'],
                password=hashed_password.decode('utf-8'),
                age=data['age']
            )
            new_user.save()
            print(f"User created with ID: {new_user.user_id}")  # Print the UUID
        except Exception as e:
            print(f"Error creating user: {str(e)}")
            return jsonify({'message': f'Database error: {str(e)}'}), 500

        # Create payload for JWT
        payload = {
            'user': {
                'id': str(new_user.user_id)  # Use user_id in JWT
            },
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }

        # Generate token
        token = jwt.encode(payload, "patientSecretKey123", algorithm="HS256")

        # Return user data and token
        return jsonify({
            'token': token,
            'user': new_user.to_json()
        }), 201

    except Exception as e:
        import traceback
        print(f"Registration error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'message': f'Server error: {str(e)}'}), 500

# Login route
@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        print(f"Login attempt for email: {data.get('email', 'unknown')}")

        # Find user by email
        try:
            user = Patient.objects(email=data['email']).first()
            if not user:
                print(f"User not found with email: {data.get('email')}")
                return jsonify({'message': 'Invalid credentials'}), 400
        except Exception as e:
            print(f"Error finding user: {str(e)}")
            return jsonify({'message': f'Database error: {str(e)}'}), 500

        # Check password
        if not bcrypt.checkpw(data['password'].encode('utf-8'), user.password.encode('utf-8')):
            print("Password check failed")
            return jsonify({'message': 'Invalid credentials'}), 400

        # Create payload for JWT
        payload = {
            'user': {
                'id': str(user.user_id) #Use user_id in JWT
            },
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }

        # Generate token
        token = jwt.encode(payload, "patientSecretKey123", algorithm="HS256")
        
        print(f"Login successful for user: {user.email}")

        # Return user data and token
        return jsonify({
            'token': token,
            'user': user.to_json()
        })
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({'message': f'Server error: {str(e)}'}), 500

# Get user route
@app.route('/api/auth/user', methods=['GET'])
@token_required
def get_user(current_user_id):
    try:
        # Find user by id
        try:
            user = Patient.objects(user_id=current_user_id).first()
            if not user:
                return jsonify({'message': 'User not found'}), 404
        except DoesNotExist:
            return jsonify({'message': 'User not found'}), 404
        except Exception as e:
            print(f"Error finding user: {str(e)}")
            return jsonify({'message': f'Database error: {str(e)}'}), 500

        # Return user data
        return jsonify(user.to_json())
    except Exception as e:
        print(f"Get user error: {str(e)}")
        return jsonify({'message': f'Server error: {str(e)}'}), 500
    
@app.route('/api/update-known-persons', methods=['POST'])
def update_known_persons():
    try:
        data = request.get_json()
        user_id = data['userId']
        
        if not user_id:
            return jsonify({'message': 'User ID is required'}), 400
            
        # Log the received user_id for debugging
        print(f"Updating known persons for user ID: {user_id}")
        
        # Check if any known persons exist before updating
        known_persons_count = KnownPerson.objects.count()
        if known_persons_count == 0:
            return jsonify({'message': 'No known persons records found to update'}), 404
            
        # Update patient_id in known_person collection
        KnownPerson.objects.update(patient_id=user_id)
        
        # Check if update was successful
        return jsonify({
            'message': 'Known persons updated successfully',
            'count': known_persons_count
        }), 200
    except Exception as e:
        # Log the full error for debugging
        import traceback
        print(f"Error in update_known_persons: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'message': f'Error updating known persons: {str(e)}'}), 500
    
@app.route('/api/known-person-ids/<patient_id>', methods=['GET'])
@token_required
def get_known_person_ids(current_user_id, patient_id):
    try:
        # Log the request for debugging
        print(f"Fetching known person IDs for patient: {patient_id}")
        
        # Query all known persons for the given patient_id
        known_persons = KnownPerson.objects(patient_id=patient_id)
        
        # Count the results for logging
        count = len(known_persons)
        print(f"Found {count} known persons for patient {patient_id}")
        
        # Extract just the IDs
        known_person_ids = [str(person.id) for person in known_persons]
        
        # Return the list of IDs
        return jsonify({
            'status': 'success',
            'count': count,
            'known_person_ids': known_person_ids
        }), 200
    except Exception as e:
        import traceback
        print(f"Error retrieving known person IDs: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': f'Error retrieving known person IDs: {str(e)}'
        }), 500

@app.route('/api/known-persons/<patient_id>', methods=['GET'])
@token_required
def get_known_persons(current_user_id, patient_id):
    try:
        # Verify that the requesting user is authorized to access this patient's data
        # (Optional: You might want to check if current_user_id matches patient_id)
        
        # Query all known persons for the given patient_id
        known_persons = KnownPerson.objects(patient_id=patient_id)
        print(known_persons)
        # Return the list of known persons
        return jsonify({
            'status': 'success',
            'known_persons': [person.to_json() for person in known_persons]
        }), 200
    except Exception as e:
        import traceback
        print(f"Error retrieving known persons: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': f'Error retrieving known persons: {str(e)}'
        }), 500

# CONVERSATION ENDPOINTS FROM SECOND FILE

@app.route('/api/save-conversation', methods=['POST'])
def save_conversation():
    """Endpoint to save a new conversation or update an existing one."""
    try:
        data = request.json
        if not data:
            return jsonify({
                'error': 'No data provided',
                'success': False
            }), 400
        
        # Add last_updated field if not present
        if not data.get('last_updated'):
            # Try to get timestamp from last message or use current time
            if data.get('conversation') and isinstance(data.get('conversation'), list) and data['conversation']:
                last_msg = data['conversation'][-1]
                if last_msg.get('timestamp'):
                    data['last_updated'] = last_msg['timestamp']
                else:
                    data['last_updated'] = datetime.datetime.now().isoformat()
            else:
                data['last_updated'] = datetime.datetime.now().isoformat()
        
        # Check required fields
        if not data.get('patient_id') or not data.get('known_person_id'):
            return jsonify({
                'error': 'Missing required fields (patient_id, known_person_id)',
                'success': False
            }), 400
        
        # Check if a conversation already exists for these users
        existing_conversation = conversation_collection.find_one({
            'patient_id': data['patient_id'],
            'known_person_id': data['known_person_id']
        })
        
        if existing_conversation:
            # Update existing conversation
            result = conversation_collection.update_one(
                {'_id': existing_conversation['_id']},
                {'$set': data}
            )
            success = result.modified_count > 0
            message = 'Conversation updated successfully' if success else 'No changes made to the conversation'
            conversation_id = str(existing_conversation['_id'])
        else:
            # Insert new conversation
            result = conversation_collection.insert_one(data)
            success = result.inserted_id is not None
            message = 'Conversation saved successfully' if success else 'Failed to save conversation'
            conversation_id = str(result.inserted_id) if result.inserted_id else None
        
        return jsonify({
            'success': success,
            'message': message,
            'id': conversation_id
        })
        
    except Exception as e:
        print(f"Error saving conversation: {str(e)}")
        return jsonify({
            'error': f'Failed to save conversation: {str(e)}',
            'success': False
        }), 500

@app.route('/api/summarize-all-conversations', methods=['GET'])
def summarize_all_conversations_endpoint():
    patient_id = request.args.get('patient_id')
    known_person_id = request.args.get('known_person_id')

    if not all([patient_id, known_person_id]):
        return jsonify({
            'error': 'Missing required parameters (patient_id, known_person_id)',
            'success': False
        }), 400

    try:
        conversations = conversation_collection.find({
            "patient_id": patient_id,
            "known_person_id": known_person_id
        }).sort("last_updated", 1)

        full_conversation_text = []
        original_messages = []
        conversation_dates = set()

        # Process each conversation document
        for conversation_doc in conversations:
            # Get the conversation array directly
            if conversation_doc.get('conversation') and isinstance(conversation_doc.get('conversation'), list):
                messages = conversation_doc.get('conversation')
                
                for message in messages:
                    # Skip empty messages
                    if not message.get('text'):
                        continue
                        
                    # Parse timestamp
                    if message.get('timestamp'):
                        try:
                            msg_timestamp = parse(message.get('timestamp', ''))
                            msg_date = msg_timestamp.date()
                        except Exception as e:
                            print(f"Error parsing timestamp: {e}")
                            # Use current date/time if parsing fails
                            msg_timestamp = datetime.datetime.now()
                            msg_date = msg_timestamp.date()
                    else:
                        # Use current date/time if no timestamp
                        msg_timestamp = datetime.datetime.now()
                        msg_date = msg_timestamp.date()
                    
                    conversation_dates.add(msg_date.isoformat())
                    
                    # Default speaker to Unknown if not provided
                    speaker = message.get('speaker', 'Unknown')
                    text = message.get('text', '')
                    
                    if text:
                        formatted_message = f"[{msg_timestamp.isoformat()}] {speaker}: {text}"
                        full_conversation_text.append(formatted_message)
                        original_messages.append({
                            'speaker': speaker,
                            'text': text,
                            'timestamp': msg_timestamp.isoformat(),
                            'date': msg_date.isoformat()
                        })

        if not full_conversation_text:
            return jsonify({
                'success': False,
                'summary': f'No conversations found between these users',
                'conversation_count': 0
            })

        conversation_text = "\n".join(full_conversation_text)
        summary = summarize_conversation(conversation_text)
        
        # Group messages by date
        messages_by_date = {}
        for msg in original_messages:
            date = msg['date']
            if date not in messages_by_date:
                messages_by_date[date] = []
            messages_by_date[date].append(msg)
        
        return jsonify({
            'success': True,
            'summary': summary,
            'conversation_length': len(conversation_text),
            'total_messages': len(full_conversation_text),
            'original_messages': original_messages,
            'messages_by_date': messages_by_date,
            'conversation_dates': sorted(list(conversation_dates)),
            'conversation_count': len(original_messages)
        })

    except Exception as e:
        print(f"Error processing request: {str(e)}")
        return jsonify({
            'error': f'Failed to process request: {str(e)}',
            'success': False
        }), 500

@app.route('/api/summarize-conversation', methods=['GET'])
def summarize_conversation_endpoint():
    patient_id = request.args.get('patient_id')
    known_person_id = request.args.get('known_person_id')
    date_str = request.args.get('date')

    print(f"Fetching conversations for date: {date_str}")

    if not all([patient_id, known_person_id, date_str]):
        return jsonify({
            'error': 'Missing required parameters (patient_id, known_person_id, date)',
            'success': False
        }), 400

    try:
        target_date = parse(date_str).date()
        today = datetime.datetime.now().date()
        
        if target_date > today:
            return jsonify({
                'error': 'Cannot fetch conversations from future dates',
                'success': False
            }), 400

        conversations = conversation_collection.find({
            "patient_id": patient_id,
            "known_person_id": known_person_id
        }).sort("last_updated", 1)

        full_conversation_text = []
        latest_conversation_id = None
        original_messages = []

        for conversation_doc in conversations:
            # Direct access to conversation array
            if conversation_doc.get('conversation') and isinstance(conversation_doc.get('conversation'), list):
                messages = conversation_doc.get('conversation')
                
                for message in messages:
                    # Skip empty messages
                    if not message.get('text'):
                        continue
                        
                    # Parse timestamp
                    if message.get('timestamp'):
                        try:
                            msg_timestamp = parse(message.get('timestamp', ''))
                            msg_date = msg_timestamp.date()
                        except Exception as e:
                            print(f"Error parsing timestamp: {e}")
                            # Use current date/time if parsing fails
                            msg_timestamp = datetime.datetime.now()
                            msg_date = msg_timestamp.date()
                    else:
                        # Use current date/time if no timestamp
                        msg_timestamp = datetime.datetime.now()
                        msg_date = msg_timestamp.date()
                    
                    if msg_date == target_date:
                        latest_conversation_id = conversation_doc['_id']
                        speaker = message.get('speaker', 'Unknown')
                        text = message.get('text', '')
                        
                        if text:
                            formatted_message = f"[{msg_timestamp.isoformat()}] {speaker}: {text}"
                            full_conversation_text.append(formatted_message)
                            original_messages.append({
                                'speaker': speaker,
                                'text': text,
                                'timestamp': msg_timestamp.isoformat()
                            })

        if not full_conversation_text:
            return jsonify({
                'success': False,
                'summary': f'No conversations found for {target_date}',
                'conversation_count': 0,
                'date': target_date.isoformat()
            })

        conversation_text = "\n".join(full_conversation_text)
        summary = summarize_conversation(conversation_text)
        
        return jsonify({
            'success': True,
            'summary': summary,
            'conversation_length': len(conversation_text),
            'conversation_id': str(latest_conversation_id) if latest_conversation_id else None,
            'total_messages': len(full_conversation_text),
            'original_messages': original_messages,
            'date': target_date.isoformat(),
            'conversation_count': len(original_messages)
        })

    except ValueError as ve:
        return jsonify({
            'error': f'Invalid date format. Please use YYYY-MM-DD: {str(ve)}',
            'success': False
        }), 400
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        return jsonify({
            'error': f'Failed to process request: {str(e)}',
            'success': False
        }), 500

# Test Groq API connection on startup
test_groq_api()

if __name__ == '__main__':
    port = 5000
    app.run(debug=True, host='0.0.0.0', port=port)