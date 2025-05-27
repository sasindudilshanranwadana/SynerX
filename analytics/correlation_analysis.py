# correlation_analysis.py
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from scipy.stats import pearsonr

def run_correlation_analysis():
    df = pd.read_csv("data/merged_dataset.csv")

    # Correlation matrix
    correlation_matrix = df[['visibility', 'speed', 'reaction_time']].corr()
    print("\nCorrelation Matrix:\n", correlation_matrix)

    # Heatmap
    sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm')
    plt.title("Weather vs Driver Behaviour Correlation")
    plt.tight_layout()
    plt.savefig("data/correlation_heatmap.png")
    plt.show()

    # Pearson Test
    r, p = pearsonr(df['visibility'], df['reaction_time'])
    print(f"\nPearson correlation (Visibility vs Reaction Time): r = {r:.2f}, p = {p:.4f}")

# Optional: for testing directly
if __name__ == "__main__":
    run_correlation_analysis()
