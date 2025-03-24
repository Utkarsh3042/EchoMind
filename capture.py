import json
from datetime import datetime
import cv2
import face_recognition
import numpy as np
import mongoengine as me
from flask import Flask, jsonify
import os
import threading
from RealtimeSTT import AudioToTextRecorder

# MongoDB Connection
MONGO_URI = "YOUR_MONGODB_URI"
me.connect(db="MONGODB_DB_NAME", host=MONGO_URI)

# Define MongoDB Models
class KnownPerson(me.Document):
    name = me.StringField(required=True)
    known_person_id = me.StringField(required=True, unique=True)
    patient_id = me.StringField(required=True)
    image_path = me.StringField(required=True)
    face_encoding = me.ListField(me.FloatField(), required=True)
    meta = {"collection": "known_person"}

class Conversation(me.Document):
    patient_id = me.StringField(required=True)
    known_person_id = me.StringField(required=True)
    conversation = me.ListField(me.DictField(), default=[])
    meta = {"collection": "conversation"}

# Initialize Flask App
app = Flask(__name__)

# Global stop event
stop_event = threading.Event()

@app.route("/start", methods=["GET"])
def detect_and_train():
    """Detect face, identify if known, capture if unknown, and transcribe audio."""
    global stop_event
    stop_event.clear()  # Clear the stop event before starting

    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        return jsonify({"error": "Could not access webcam"}), 500

    print("Starting real-time face detection and training...")
    print("Press 'q' to quit")

    # Reduce resolution for faster processing
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    image_dir = os.path.join(os.path.dirname(__file__), 'face_images')
    if not os.path.exists(image_dir):
        os.makedirs(image_dir)

    # Initialize variables
    audio_text = ""
    audio_lock = threading.Lock()

    # Cache known encodings and names
    known_persons = KnownPerson.objects()
    known_encodings = [np.array(person.face_encoding) for person in known_persons]
    known_names = [person.name for person in known_persons]
    known_person_ids = [person.known_person_id for person in known_persons]
    patient_ids = [person.patient_id for person in known_persons]

    person_name = "Unknown"
    person_id = None
    patient_id = None

    # Initialize the RealtimeSTT recorder
    recorder = AudioToTextRecorder()

    # New variables for capturing unknown faces
    face_encodings_list = []
    captured = False
    MAX_NEW_FACES = 5

    def process_text(text):
        """Callback to process transcribed text."""
        nonlocal audio_text
        with audio_lock:
            audio_text = text
        print(f"Transcribed Text: {text}")

        # Save the conversation to the database
        if person_id and patient_id:
            conversation_entry = {
                "text": text,
                "timestamp": datetime.now().isoformat()
            }
            existing_conversation = Conversation.objects(patient_id=patient_id, known_person_id=person_id).first()
            if existing_conversation:
                # Append to the existing conversation
                existing_conversation.conversation.append(conversation_entry)
                existing_conversation.save()
            else:
                # Create a new conversation record
                new_conversation = Conversation(
                    patient_id=patient_id,
                    known_person_id=person_id,
                    conversation=[conversation_entry]
                )
                new_conversation.save()

    def process_audio():
        """Continuously process audio input for speech-to-text."""
        print("Listening for speech...")
        while not stop_event.is_set():  # Check the stop event
            try:
                # Use RealtimeSTT to capture and process audio
                recorder.text(process_text)
            except Exception as e:
                print(f"Error: {e}")

    # Start audio processing in a separate threads
    audio_thread = threading.Thread(target=process_audio, daemon=True)
    audio_thread.start()

    frame_count = 0  # To process every nth frame

    while not stop_event.is_set():  # Check the stop event
        ret, frame = cap.read()
        if not ret:
            continue

        # Process every 5th frame to reduce CPU usage
        frame_count += 1
        if frame_count % 5 != 0:
            # Display transcribed audio text on the frame
            with audio_lock:
                cv2.putText(frame, f"Audio: {audio_text}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.imshow("Face Recognition", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
            continue

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_locations = face_recognition.face_locations(rgb_frame)

        if face_locations:  # Only process if faces are detected
            print(f"Detected {len(face_locations)} face(s).\n")  # Debugging
            face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

            for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
                if known_encodings:
                    face_distances = face_recognition.face_distance(known_encodings, face_encoding)
                    best_match_index = np.argmin(face_distances)

                    if face_distances[best_match_index] < 0.6:
                        person_name = known_names[best_match_index]
                        print("Person Name:", person_name,"\n")
                        person_id = known_person_ids[best_match_index]
                        patient_id = patient_ids[best_match_index]
                        confidence = round((1 - face_distances[best_match_index]) * 100, 2)
                        label = f"{person_name} ({confidence}%)"
                    else:
                        person_name = "Unknown"
                else:
                    person_name = "Unknown"

                # Handle unknown faces
                if person_name == "Unknown" and not captured:
                    print("Unknown face detected, capturing images...\n")
                    face_encodings_list.append(face_encoding)
                    if len(face_encodings_list) >= MAX_NEW_FACES:
                        captured = True

                if captured:
                    avg_encoding = np.mean(face_encodings_list, axis=0).tolist()
                    image_path = os.path.join(image_dir, f"new_person_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg")
                    cv2.imwrite(image_path, frame)
                    new_person = KnownPerson(
                        name="NewPerson",
                        known_person_id=f"NewPerson_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                        patient_id="patient_new",
                        image_path=image_path,
                        face_encoding=avg_encoding
                    )
                    new_person.save()
                    return jsonify({"message": "New face trained and saved", "name": "NewPerson"}), 200

                # Draw rectangle and label
                color = (0, 255, 0) if person_name != "Unknown" else (0, 0, 255)
                cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
                cv2.putText(frame, person_name, (left, top - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

        else:
            print("No faces detected.\n")  # Debugging

        # Display transcribed audio text on the frame
        with audio_lock:
            cv2.putText(frame, f"Audio: {audio_text}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        cv2.imshow("Face Recognition", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()

    return jsonify({"message": "Face detection and audio transcription completed"}), 200

@app.route("/stop", methods=["GET"])
def stop_detection():
    """Stop the detect_and_train function."""
    global stop_event
    stop_event.set()  # Signal the stop event
    print("Stopping face detection and audio transcription...")
    return jsonify({"message": "Face detection and audio transcription stopped"}), 200

if __name__ == "__main__":
    print("Starting Flask app...")
    app.run(debug=True, port=5000)
