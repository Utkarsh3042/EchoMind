import random
import time
from datetime import datetime, timedelta

# For browser-based applications, we'll mostly be receiving location data from
# the frontend via JavaScript's Geolocation API, so this module becomes simpler

def simulate_location():
    """
    Simulates a GPS location when real location can't be fetched from the frontend.
    This serves as a fallback.
    """
    # For demonstration, generate a random location near a fixed point
    base_lat = 37.7749  # Sample latitude (San Francisco)
    base_lng = -122.4194  # Sample longitude (San Francisco)
    
    # Add some random variation (within ~500m)
    lat = base_lat + (random.random() - 0.5) * 0.01
    lng = base_lng + (random.random() - 0.5) * 0.01
    
    # In a real application, you would use reverse geocoding to get the address
    address = "123 Main Street, San Francisco, CA 94105"
    
    return {
        "latitude": lat,
        "longitude": lng,
        "address": address,
        "maps_url": f"https://www.google.com/maps?q={lat},{lng}",
        "source": "simulated"
    }

def get_current_location(browser_location=None, battery_percentage=None):
    """
    Gets the user's current location and battery status.
    
    Args:
        browser_location (dict, optional): Location data from browser's Geolocation API
        battery_percentage (int, optional): Battery percentage from browser's Battery API
        
    Returns:
        dict: Location data with battery percentage and tracking information
    """
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # If browser provided location data, use it
    if browser_location and 'latitude' in browser_location and 'longitude' in browser_location:
        location_data = {
            "latitude": browser_location.get('latitude'),
            "longitude": browser_location.get('longitude'),
            "accuracy": browser_location.get('accuracy', 'Unknown'),
            "maps_url": f"https://www.google.com/maps?q={browser_location.get('latitude')},{browser_location.get('longitude')}",
            "source": "browser_geolocation",
            "last_updated": current_time
        }
        
        # If address is provided by the browser/frontend, use it
        if 'address' in browser_location:
            location_data["address"] = browser_location.get('address')
        else:
            # Otherwise use a placeholder - in production you might use reverse geocoding here
            location_data["address"] = "Address information not available"
            
    else:
        # Fall back to simulated location
        location_data = simulate_location()
        location_data["last_updated"] = current_time
    
    # Add battery information if provided by the browser
    if battery_percentage is not None:
        location_data["battery_percentage"] = battery_percentage
    else:
        # Use a simulated battery value
        location_data["battery_percentage"] = random.randint(20, 95)
        location_data["battery_source"] = "simulated"
    
    # Add tracking information - in a real app, you would track when the SOS was initiated
    # and how long it has been active
    tracking_start = datetime.now()
    tracking_expiry = tracking_start + timedelta(hours=1)
    remaining_seconds = (tracking_expiry - tracking_start).total_seconds()
    
    location_data["tracking_active"] = True
    location_data["tracking_started"] = tracking_start.strftime("%Y-%m-%d %H:%M:%S")
    location_data["tracking_expires"] = tracking_expiry.strftime("%Y-%m-%d %H:%M:%S")
    location_data["tracking_expires_in"] = {
        "hours": int(remaining_seconds // 3600),
        "minutes": int((remaining_seconds % 3600) // 60),
        "seconds": int(remaining_seconds % 60)
    }
    
    return location_data