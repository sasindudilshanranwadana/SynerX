import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO

def plot_status_by_type():
    tracking_df = pd.read_csv('./data/tracking_results.csv')
    status_counts = tracking_df.groupby(['vehicle_type', 'status']).size().unstack(fill_value=0)
    fig, ax = plt.subplots()
    status_counts.plot(kind='bar', stacked=True, ax=ax)
    plt.title('Vehicle Status by Type')
    plt.ylabel('Count')
    plt.xticks(rotation=0)
    plt.tight_layout()
    buf = BytesIO()
    plt.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)
    return buf

def plot_compliance_pie():
    tracking_df = pd.read_csv('./data/tracking_results.csv')
    compliance_counts = tracking_df['compliance'].value_counts().rename({1: 'Compliant', 0: 'Non-compliant'})
    fig, ax = plt.subplots()
    compliance_counts.plot(kind='pie', autopct='%1.1f%%', startangle=90, ax=ax)
    plt.title('Compliance Rate')
    plt.ylabel('')
    plt.tight_layout()
    buf = BytesIO()
    plt.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)
    return buf

def plot_reaction_time_hist():
    tracking_df = pd.read_csv('./data/tracking_results.csv')
    plt.figure(figsize=(8, 4))
    for vtype in tracking_df['vehicle_type'].unique():
        subset = tracking_df[(tracking_df['vehicle_type'] == vtype) & (tracking_df['reaction_time'].notnull())]
        sns.histplot(subset['reaction_time'], label=vtype, kde=True, bins=20, alpha=0.5)
    plt.legend()
    plt.title('Reaction Time Distribution by Vehicle Type')
    plt.xlabel('Reaction Time (seconds)')
    plt.tight_layout()
    buf = BytesIO()
    plt.savefig(buf, format="png")
    plt.close()
    buf.seek(0)
    return buf

def plot_vehicle_count():
    count_df = pd.read_csv('./data/vehicle_count.csv')
    if 'date' in count_df.columns and count_df['date'].nunique() > 1:
        count_df['date'] = pd.to_datetime(count_df['date'])
        pivot = count_df.pivot_table(index='date', columns='vehicle_type', values='count', aggfunc='sum')
        pivot.plot()
        plt.title('Vehicle Count Over Time')
        plt.ylabel('Count')
        plt.xticks(rotation=45)
        plt.tight_layout()
    else:
        sns.barplot(data=count_df, x='vehicle_type', y='count')
        plt.title('Total Vehicle Count by Type')
        plt.ylabel('Count')
        plt.tight_layout()
    buf = BytesIO()
    plt.savefig(buf, format="png")
    plt.close()
    buf.seek(0)
    return buf
