# weather_enricher.py
import pandas as pd
import requests

# === Your API Key and Location ===
API_KEY = "c850af7486aa07fd95afb4c9c60ea50b"  
LAT, LON = -37.8136, 144.9631  

# === File paths ===
INPUT_PATH = "data/merged_dataset.csv"
OUTPUT_PATH = "data/merged_dataset_enriched.csv"

# === Function to fetch weather ===
def fetch_weather():
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "lat": LAT,
        "lon": LON,
        "appid": API_KEY,
        "units": "metric"
    }

    response = requests.get(url, params=params)
    if response.status_code == 200:
        data = response.json()
        return {
            "visibility": data.get("visibility", 0) / 1000,  
            "temp": data["main"]["temp"],
            "weather": data["weather"][0]["main"]
        }
    else:
        print(f"❌ Failed to fetch weather: {response.status_code}")
        return {"visibility": None, "temp": None, "weather": None}

# === Function to enrich dataset ===
def enrich_csv(input_path=INPUT_PATH, output_path=OUTPUT_PATH):
    print("🔄 Reading input dataset...")
    df = pd.read_csv(input_path)

    print("🌤️ Fetching weather data from OpenWeatherMap...")
    weather_data = fetch_weather()

    print("🧪 Adding weather columns to each row...")
    df['visibility'] = weather_data['visibility']
    df['temp'] = weather_data['temp']
    df['weather'] = weather_data['weather']

    print(f"💾 Saving enriched dataset to {output_path}...")
    df.to_csv(output_path, index=False)
    print("✅ Done: Weather enrichment complete.")

# === Main entry point ===
if __name__ == "__main__":
    enrich_csv()
