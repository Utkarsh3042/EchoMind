# Real-time speech recognition using Vosk and MongoDB Atlas
import json
import queue
import sys
import os
import pyaudio
import vosk
import threading
import time
from pymongo import MongoClient
from datetime import datetime

class VoskRecognizer:
    def __init__(self, model_path="vosk-model-small-en-us", mongo_uri=None, db_name="alzheimers_db", collection_name="contacts"):
        """
        Initialize the Vosk speech recognizer and MongoDB connection.
        model_path: path to the Vosk model directory
        mongo_uri: MongoDB Atlas connection string
        db_name: MongoDB database name
        collection_name: MongoDB collection name
        """
        # Check if model exists, download if not
        if not os.path.exists(model_path):
            print(f"Model {model_path} not found. Please download it from https://alphacephei.com/vosk/models")
            sys.exit(1)
            
        # Configuration
        self.sample_rate = 16000
        self.frame_size = 4000  # 250ms of audio at 16kHz
        
        # Initialize Vosk model
        print(f"Loading Vosk model from {model_path}...")
        self.model = vosk.Model(model_path)
        print("Model loaded!")
        
        # Create recognizer
        self.rec = vosk.KaldiRecognizer(self.model, self.sample_rate)
        self.rec.SetWords(True)  # Enable word timestamps
        
        # Initialize PyAudio
        self.p = pyaudio.PyAudio()
        
        # MongoDB setup
        if mongo_uri:
            self.client = MongoClient(mongo_uri)
            self.db = self.client[db_name]
            self.collection = self.db[collection_name]
        else:
            self.client = None
        
        # For storing partial results
        self.partial_result = ""
        self.running = False
        self.current_person = None  # Name of the recognized person
        
    def set_recognized_person(self, name):
        """Set the name of the recognized person."""
        self.current_person = name
        
    def start(self):
        """Start speech recognition."""
        self.running = True

        # Re-initialize PyAudio if it was terminated
        if not hasattr(self, 'p') or self.p is None:
            self.p = pyaudio.PyAudio()

        # Open microphone stream
        self.stream = self.p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self.sample_rate,
            input=True,
            frames_per_buffer=self.frame_size
        )

        print("Listening... (Press Ctrl+C to stop)")

        # Start processing in a separate thread
        self.process_thread = threading.Thread(target=self._process_audio)
        self.process_thread.daemon = True
        self.process_thread.start()
        
    def stop(self):
        """Stop speech recognition."""
        self.running = False
        time.sleep(0.3)  # Allow thread to finish
        if hasattr(self, 'stream') and self.stream is not None:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None
        if hasattr(self, 'p') and self.p is not None:
            self.p.terminate()
            self.p = None
        print("\nSpeech recognition stopped.")
        
    def _process_audio(self):
        """Process audio from microphone."""
        try:
            while self.running:
                # Read audio data
                data = self.stream.read(self.frame_size, exception_on_overflow=False)
                
                # Feed data to recognizer
                if self.rec.AcceptWaveform(data):
                    # Full result - reset partial text
                    result = json.loads(self.rec.Result())
                    text = result.get("text", "").strip()
                    if text and self.current_person:
                        print(f"\nYou said: {text}")
                        print("Listening...")
                        self._store_conversation(text)
                    self.partial_result = ""
                else:
                    # Partial result
                    partial = json.loads(self.rec.PartialResult())
                    partial_text = partial.get("partial", "").strip()
                    
                    # Only print if different from last partial result
                    if partial_text and partial_text != self.partial_result:
                        self.partial_result = partial_text
                        # Uncomment to see partial results (can be noisy)
                        # print(f"\rPartial: {partial_text}", end="", flush=True)
        
        except Exception as e:
            print(f"\nError in audio processing: {e}")
            self.running = False

    def _store_conversation(self, text):
        """Store the conversation in MongoDB."""
        if not self.client or not self.current_person:
            return

        # Prepare the conversation data
        conversation_entry = {
            "text": text,
            "timestamp": datetime.utcnow().isoformat()
        }

        # Search for the person by name in the 'contacts' collection
        person = self.collection.find_one({"name": self.current_person})

        if person:
            # Update the conversation_data field by appending the new conversation
            self.collection.update_one(
                {"_id": person["_id"]},
                {"$push": {"conversation_data": conversation_entry}}
            )
            print(f"Updated conversation for {self.current_person}: {text}")
        else:
            print(f"Person '{self.current_person}' not found in the database.")

def download_model():
    """Helper function to download a Vosk model."""
    import urllib.request
    import zipfile
    
    model_name = "vosk-model-small-en-us-0.15"
    model_url = f"https://alphacephei.com/vosk/models/{model_name}.zip"
    zip_path = f"{model_name}.zip"
    
    print(f"Downloading Vosk model from {model_url}...")
    urllib.request.urlretrieve(model_url, zip_path)
    
    print("Extracting model...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(".")
    
    # Rename folder to standard name
    os.rename(model_name, "vosk-model-small-en-us")
    
    # Clean up zip file
    os.remove(zip_path)
    print("Model download complete!")

def main():
    model_path = "vosk-model-small-en-us"
    mongo_uri = "mongodb+srv://bossutkarsh30:YOCczedaElKny6Dd@cluster0.gixba.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"  # Replace with your MongoDB Atlas URI
    
    # Uncomment to enable automatic model download (requires internet connection)
    # if not os.path.exists(model_path):
    #     download_model()
    
    # Create and start recognizer
    recognizer = VoskRecognizer(model_path, mongo_uri)
    
    # Simulate setting the recognized person (this should be set dynamically by recognition_thread)
    recognizer.set_recognized_person("Sarah")  # Example: Replace with actual recognized name
    
    try:
        recognizer.start()
        # Keep main thread alive
        while True:
            time.sleep(0.1)
    except KeyboardInterrupt:
        recognizer.stop()

if __name__ == "__main__":
    main()