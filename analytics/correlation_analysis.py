# correlation_analysis.py
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from scipy.stats import pearsonr

def run_correlation_analysis():
    # Load enriched dataset
    df = pd.read_csv("data/merged_dataset_enriched.csv")

    # === TIME OF DAY CLASSIFICATION ===
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['hour'] = df['timestamp'].dt.hour

    def classify_time(hour):
        if 5 <= hour <= 11:
            return 'Morning'
        elif 12 <= hour <= 16:
            return 'Afternoon'
        elif 17 <= hour <= 20:
            return 'Evening'
        else:
            return 'Night'

    df['time_of_day'] = df['hour'].apply(classify_time)

    # === WEATHER CATEGORY CLASSIFICATION ===
    def classify_weather(w):
        if w in ["Clear", "Clouds"]:
            return "Good"
        elif w in ["Mist", "Haze", "Drizzle"]:
            return "Moderate"
        elif w in ["Rain", "Snow", "Fog", "Thunderstorm"]:
            return "Hazardous"
        else:
            return "Unknown"

    df['weather_category'] = df['weather'].apply(classify_weather)

    # === VIOLATION DETECTION ===
    df['violation'] = ((df['stopped'] == 0) | (df['reaction_time'] > 2.0)).astype(int)

    # === CORRELATION MATRIX ===
    print("\n🔍 CORRELATION MATRIX:")
    correlation_matrix = df[['visibility', 'speed', 'reaction_time']].corr()
    print(correlation_matrix.round(2))

    # === Pearson Test ===
    r, p = pearsonr(df['visibility'], df['reaction_time'])
    print("\n📊 Pearson Correlation (Visibility vs Reaction Time)")
    print(f"   r = {r:.2f}, p = {p:.4f}")

    # === Heatmap ===
    plt.figure(figsize=(6, 5))
    sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm')
    plt.title("Weather vs Driver Behaviour Correlation")
    plt.xlabel("Features")
    plt.ylabel("Features")
    plt.tight_layout()
    plt.savefig("data/correlation_heatmap.png")
    plt.show()

    # === Reaction Time by Time of Day ===
    plt.figure()
    sns.barplot(data=df, x='time_of_day', y='reaction_time', order=['Morning', 'Afternoon', 'Evening', 'Night'])
    plt.title("Avg Reaction Time by Time of Day")
    plt.tight_layout()
    plt.savefig("data/reaction_time_by_time_of_day.png")
    plt.show()

    # === Violation Rate by Weather Category ===
    print("\n🚦 Violation Rate by Weather Category:")
    violation_stats = df.groupby('weather_category')['violation'].mean().reset_index()
    violation_stats['violation'] *= 100  # Convert to %
    print(violation_stats.round(2))

    plt.figure()
    sns.barplot(data=violation_stats, x='weather_category', y='violation', palette='coolwarm')
    plt.title("Violation Rate by Weather Category")
    plt.ylabel("Violation Rate (%)")
    plt.ylim(0, 100)
    plt.tight_layout()
    plt.savefig("data/violation_rate_by_weather.png")
    plt.show()

if __name__ == "__main__":
    run_correlation_analysis()
