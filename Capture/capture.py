from flask import Flask, request, jsonify
from flask_cors import CORS # Import CORS
import os
import cv2
import numpy as np
import torch
from torchvision import transforms
from pymongo import MongoClient
from werkzeug.utils import secure_filename
import argparse
import shutil
from face_detection.scrfd.detector import SCRFD
from face_recognition.arcface.model import iresnet_inference
from face_recognition.arcface.utils import read_features, compare_encodings
import threading
import time
import yaml
from face_alignment.alignment import norm_crop
from face_tracking.tracker.byte_tracker import BYTETracker
from face_tracking.tracker.visualize import plot_tracking
from speechtotext import VoskRecognizer
import requests 

app = Flask(__name__)
CORS(app)

#MONGODB
mongo_uri = "mongodb+srv://bossutkarsh30:YOCczedaElKny6Dd@cluster0.gixba.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"  # Replace with your MongoDB Atlas URI
# Initialize the VoskRecognizer instance
vosk_recognizer = VoskRecognizer(model_path="vosk-model-small-en-us", mongo_uri=mongo_uri)

# Add a global flag to control the threads
stop_threads = False

#add_persons.py

# Check if CUDA is available and set the device accordingly
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Initialize the face detector (Choose one of the detectors)
# detector = Yolov5Face(model_file="face_detection/yolov5_face/weights/yolov5n-face.pt")
detector = SCRFD(model_file="face_detection/scrfd/weights/scrfd_2.5g_bnkps.onnx")

# Initialize the face recognizer
recognizer = iresnet_inference(
    model_name="r100", path="face_recognition/arcface/weights/arcface_r100.pth", device=device
)

images_names, images_embs = read_features(feature_path="./datasets/face_features/feature")

# Mapping of face IDs to names
id_face_mapping = {}

# Data mapping for tracking information
data_mapping = {
    "raw_image": [],
    "tracking_ids": [],
    "detection_bboxes": [],
    "detection_landmarks": [],
    "tracking_bboxes": [],
}



@torch.no_grad()
def get_feature(face_image):
    """
    Extract facial features from an image using the face recognition model.

    Args:
        face_image (numpy.ndarray): Input facial image.

    Returns:
        numpy.ndarray: Extracted facial features.
    """
    # Define a series of image preprocessing steps
    face_preprocess = transforms.Compose(
        [
            transforms.ToTensor(),
            transforms.Resize((112, 112)),
            transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
        ]
    )

    # Convert the image to RGB format
    face_image = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)

    # Apply the defined preprocessing to the image
    face_image = face_preprocess(face_image).unsqueeze(0).to(device)

    # Use the model to obtain facial features
    emb_img_face = recognizer(face_image)[0].cpu().numpy()

    # Normalize the features
    images_emb = emb_img_face / np.linalg.norm(emb_img_face)
    return images_emb

def add_persons(backup_dir, add_persons_dir, faces_save_dir, features_path):
    """
    Add a new person to the face recognition database.

    Args:
        backup_dir (str): Directory to save backup data.
        add_persons_dir (str): Directory containing images of the new person.
        faces_save_dir (str): Directory to save the extracted faces.
        features_path (str): Path to save face features.
    """
    # Initialize lists to store names and features of added images
    images_name = []
    images_emb = []

    # Read the folder with images of the new person, extract faces, and save them
    for name_person in os.listdir(add_persons_dir):
        person_image_path = os.path.join(add_persons_dir, name_person)

        # Create a directory to save the faces of the person
        person_face_path = os.path.join(faces_save_dir, name_person)
        os.makedirs(person_face_path, exist_ok=True)

        for image_name in os.listdir(person_image_path):
            if image_name.endswith(("png", "jpg", "jpeg")):
                input_image = cv2.imread(os.path.join(person_image_path, image_name))

                # Detect faces and landmarks using the face detector
                bboxes, landmarks = detector.detect(image=input_image)

                # Extract faces
                for i in range(len(bboxes)):
                    # Get the number of files in the person's path
                    number_files = len(os.listdir(person_face_path))

                    # Get the location of the face
                    x1, y1, x2, y2, score = bboxes[i]

                    # Extract the face from the image
                    face_image = input_image[y1:y2, x1:x2]

                    # Path to save the face
                    path_save_face = os.path.join(person_face_path, f"{number_files}.jpg")

                    # Save the face to the database
                    cv2.imwrite(path_save_face, face_image)

                    # Extract features from the face
                    images_emb.append(get_feature(face_image=face_image))
                    images_name.append(name_person)

    # Check if no new person is found
    if images_emb == [] and images_name == []:
        print("No new person found!")
        return None

    # Convert lists to arrays
    images_emb = np.array(images_emb)
    images_name = np.array(images_name)

    # Ensure images_emb has the correct shape
    if len(images_emb.shape) == 3:
        images_emb = images_emb.squeeze(axis=1)

    # Read existing features if available
    features = read_features(features_path)

    if features is not None:
        # Unpack existing features
        old_images_name, old_images_emb = features

        # Combine new features with existing features
        images_name = np.hstack((old_images_name, images_name))
        images_emb = np.vstack((old_images_emb, images_emb))

        print("Update features!")

    # Save the combined features
    np.savez_compressed(features_path, images_name=images_name, images_emb=images_emb)

    # Move the data of the new person to the backup data directory
    for sub_dir in os.listdir(add_persons_dir):
        dir_to_move = os.path.join(add_persons_dir, sub_dir)
        shutil.move(dir_to_move, backup_dir, copy_function=shutil.copytree)

    print("Successfully added new person!")


@app.route('/add', methods=['POST'])
def add():
    """
    Flask route to add a new person to the face recognition database.
    Accepts a username and a photo URL via a POST request with JSON data.
    """
    # Get JSON data from the request body
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    # Get the username from the JSON data
    username = data.get("username")
    if not username:
        return jsonify({"error": "Username is required"}), 400

    # Get the photo URL from the JSON data
    photo_url = data.get("photo_url")
    if not photo_url:
        return jsonify({"error": "Photo URL is required"}), 400

    # Secure the filename and create the user's directory
    username_dir = os.path.join("./datasets/new_persons", secure_filename(username))
    os.makedirs(username_dir, exist_ok=True)

    # Fetch the image from the URL
    try:
        response = requests.get(photo_url, stream=True)
        response.raise_for_status()  # Raise an error for bad responses (4xx or 5xx)
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to fetch the image from the URL: {e}"}), 400

    # Save the image in the user's directory
    image_path = os.path.join(username_dir, "photo.jpg")  # Save with a fixed name
    with open(image_path, "wb") as image_file:
        for chunk in response.iter_content(1024):
            image_file.write(chunk)

    # Parse query parameters from the HTTP request (if any, though not expected from frontend)
    # These typically come from URL parameters, not the JSON body
    backup_dir = request.args.get("backup-dir", "./datasets/backup")
    add_persons_dir = request.args.get("add-persons-dir", "./datasets/new_persons")
    faces_save_dir = request.args.get("faces-save-dir", "./datasets/data/")
    features_path = request.args.get("features-path", "./datasets/face_features/feature")

    # Run the main function
    add_persons(
        backup_dir=backup_dir,
        add_persons_dir=add_persons_dir,
        faces_save_dir=faces_save_dir,
        features_path=features_path,
    )

    # Return a valid response
    return jsonify({"message": f"Image saved successfully for user '{username}' and database updated."}), 200


def load_config(file_name):
    """
    Load a YAML configuration file.

    Args:
        file_name (str): The path to the YAML configuration file.

    Returns:
        dict: The loaded configuration as a dictionary.
    """
    with open(file_name, "r") as stream:
        try:
            return yaml.safe_load(stream)
        except yaml.YAMLError as exc:
            print(exc)


def process_tracking(frame, detector, tracker, args, frame_id, fps):
    """
    Process tracking for a frame.

    Args:
        frame: The input frame.
        detector: The face detector.
        tracker: The object tracker.
        args (dict): Tracking configuration parameters.
        frame_id (int): The frame ID.
        fps (float): Frames per second.

    Returns:
        numpy.ndarray: The processed tracking image.
    """
    # Face detection and tracking
    outputs, img_info, bboxes, landmarks = detector.detect_tracking(image=frame)

    tracking_tlwhs = []
    tracking_ids = []
    tracking_scores = []
    tracking_bboxes = []

    if outputs is not None:
        online_targets = tracker.update(
            outputs, [img_info["height"], img_info["width"]], (128, 128)
        )

        for i in range(len(online_targets)):
            t = online_targets[i]
            tlwh = t.tlwh
            tid = t.track_id
            vertical = tlwh[2] / tlwh[3] > args["aspect_ratio_thresh"]
            if tlwh[2] * tlwh[3] > args["min_box_area"] and not vertical:
                x1, y1, w, h = tlwh
                tracking_bboxes.append([x1, y1, x1 + w, y1 + h])
                tracking_tlwhs.append(tlwh)
                tracking_ids.append(tid)
                tracking_scores.append(t.score)

        tracking_image = plot_tracking(
            img_info["raw_img"],
            tracking_tlwhs,
            tracking_ids,
            names=id_face_mapping,
            frame_id=frame_id + 1,
            fps=fps,
        )
    else:
        tracking_image = img_info["raw_img"]

    data_mapping["raw_image"] = img_info["raw_img"]
    data_mapping["detection_bboxes"] = bboxes
    data_mapping["detection_landmarks"] = landmarks
    data_mapping["tracking_ids"] = tracking_ids
    data_mapping["tracking_bboxes"] = tracking_bboxes

    return tracking_image


@torch.no_grad()
def get_feature(face_image):
    """
    Extract features from a face image.

    Args:
        face_image: The input face image.

    Returns:
        numpy.ndarray: The extracted features.
    """
    face_preprocess = transforms.Compose(
        [
            transforms.ToTensor(),
            transforms.Resize((112, 112)),
            transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
        ]
    )

    # Convert to RGB
    face_image = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)

    # Preprocess image (BGR)
    face_image = face_preprocess(face_image).unsqueeze(0).to(device)

    # Inference to get feature
    emb_img_face = recognizer(face_image).cpu().numpy()

    # Convert to array
    images_emb = emb_img_face / np.linalg.norm(emb_img_face)

    return images_emb


def recognition(face_image):
    """
    Recognize a face image.

    Args:
        face_image: The input face image.

    Returns:
        tuple: A tuple containing the recognition score and name.
    """
    # Get feature from face
    query_emb = get_feature(face_image)

    score, id_min = compare_encodings(query_emb, images_embs)
    name = images_names[id_min]
    score = score[0]

    return score, name


def mapping_bbox(box1, box2):
    """
    Calculate the Intersection over Union (IoU) between two bounding boxes.

    Args:
        box1 (tuple): The first bounding box (x_min, y_min, x_max, y_max).
        box2 (tuple): The second bounding box (x_min, y_min, x_max, y_max).

    Returns:
        float: The IoU score.
    """
    # Calculate the intersection area
    x_min_inter = max(box1[0], box2[0])
    y_min_inter = max(box1[1], box2[1])
    x_max_inter = min(box1[2], box2[2])
    y_max_inter = min(box1[3], box2[3])

    intersection_area = max(0, x_max_inter - x_min_inter + 1) * max(
        0, y_max_inter - y_min_inter + 1
    )

    # Calculate the area of each bounding box
    area_box1 = (box1[2] - box1[0] + 1) * (box1[3] - box1[1] + 1)
    area_box2 = (box2[2] - box2[0] + 1) * (box2[3] - box2[1] + 1)

    # Calculate the union area
    union_area = area_box1 + area_box2 - intersection_area

    # Calculate IoU
    iou = intersection_area / union_area

    return iou


def tracking(detector, args):
    """
    Face tracking in a separate thread.

    Args:
        detector: The face detector.
        args (dict): Tracking configuration parameters.
    """
    global stop_threads  # Access the global stop_threads flag

    # Initialize variables for measuring frame rate
    start_time = time.time_ns()
    frame_count = 0
    fps = -1

    # Initialize a tracker and a timer
    tracker = BYTETracker(args=args, frame_rate=30)
    frame_id = 0

    cap = cv2.VideoCapture(0)

    while not stop_threads:  # Check the stop_threads flag
        _, img = cap.read()

        tracking_image = process_tracking(img, detector, tracker, args, frame_id, fps)

        # Calculate and display the frame rate
        frame_count += 1
        if frame_count >= 30:
            fps = 1e9 * frame_count / (time.time_ns() - start_time)
            frame_count = 0
            start_time = time.time_ns()

        cv2.imshow("Face Recognition", tracking_image)

        # Check for user exit input
        ch = cv2.waitKey(1)
        if ch == 27 or ch == ord("q") or ch == ord("Q"):
            break

    # Release the video capture and close the OpenCV window
    cap.release()
    cv2.destroyAllWindows()
    print("Tracking stopped.")


@app.route('/stop', methods=['POST'])
def stop_recognition():
    """
    Flask route to stop face recognition and speech-to-text threads.
    """
    global stop_threads
    stop_threads = True  # Set the flag to stop threads

    # Stop the VoskRecognizer if it's running
    if vosk_recognizer.running:
        vosk_recognizer.stop()
        print("Stopped speech recognition.")

    return jsonify({"message": "Face recognition and speech-to-text threads stopped successfully."}), 200


def recognition_thread():
    """
    Face recognition in a separate thread.
    """
    global stop_threads
    current_person = None  # Track the currently recognized person

    while not stop_threads:
        raw_image = data_mapping["raw_image"]
        detection_landmarks = data_mapping["detection_landmarks"]
        detection_bboxes = data_mapping["detection_bboxes"]
        tracking_ids = data_mapping["tracking_ids"]
        tracking_bboxes = data_mapping["tracking_bboxes"]

        for i in range(len(tracking_bboxes)):
            for j in range(len(detection_bboxes)):
                mapping_score = mapping_bbox(box1=tracking_bboxes[i], box2=detection_bboxes[j])
                if mapping_score > 0.9:
                    face_alignment = norm_crop(img=raw_image, landmark=detection_landmarks[j])

                    score, name = recognition(face_image=face_alignment)
                    if name is not None:
                        if score < 0.25:
                            caption = "UN_KNOWN"
                        else:
                            caption = f"{name}:{score:.2f}"

                        # Update the recognized person's name
                        if name != current_person and score >= 0.25:
                            current_person = name
                            vosk_recognizer.set_recognized_person(current_person)
                            vosk_recognizer.start()  # Start speech recognition
                            print(f"Started speech recognition for {current_person}")

                        id_face_mapping[tracking_ids[i]] = caption

                        detection_bboxes = np.delete(detection_bboxes, j, axis=0)
                        detection_landmarks = np.delete(detection_landmarks, j, axis=0)

                        break

        # Stop speech recognition if no person is detected
        if not tracking_bboxes and current_person:
            vosk_recognizer.stop()
            print(f"Stopped speech recognition for {current_person}")
            current_person = None

        if tracking_bboxes == []:
            print("Waiting for a person...")

    print("Recognition thread stopped.")


@app.route('/recognize', methods=['GET'])
def start_recognition():
    """
    Flask route to start face tracking and recognition threads.
    """
    global stop_threads
    stop_threads = False  # Reset the flag to allow threads to run

    file_name = "./face_tracking/config/config_tracking.yaml"
    config_tracking = load_config(file_name)

    # Start tracking thread
    thread_track = threading.Thread(
        target=tracking,
        args=(detector, config_tracking),
    )
    thread_track.start()

    # Start recognition thread
    thread_recognize = threading.Thread(target=recognition_thread)
    thread_recognize.start()

    # Return a valid response
    return jsonify({"message": "Face tracking and recognition threads started successfully."}), 200


if __name__ == "__main__":
    app.run(debug=True)