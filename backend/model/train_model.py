"""
GreenLedger Carbon Estimation Model v3.0
=========================================
Improvements:
1. Seasonal correlation — NDVI and moisture correlated with crop season
2. Soil type variation — 4 Maharashtra soil types with different carbon factors
3. No-till maturity — carbon benefit increases over years of practice
4. Irrigation effect — irrigated farms maintain moisture in dry seasons
5. 11 features instead of 7
6. 4000 training samples
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error
from sklearn.preprocessing import StandardScaler
import joblib, os

SEED = 42
np.random.seed(SEED)

def generate(n=4000):
    area           = np.random.uniform(0.3, 25.0, n)
    soc            = np.random.uniform(0.3, 6.0, n)
    months         = np.random.randint(1, 13, n).astype(float)
    practice       = np.random.choice([0,1,2,3], n, p=[0.45,0.28,0.18,0.09])
    practice_years = np.random.randint(0, 12, n).astype(float)
    notill_maturity= np.clip(practice_years / 5.0, 0, 1.0)
    has_irrigation = np.random.choice([0,1], n, p=[0.40,0.60]).astype(float)

    soil_types  = np.random.choice(['black_cotton','alluvial','red_laterite','shallow_rocky'], n, p=[0.45,0.20,0.25,0.10])
    soil_factor = np.where(soil_types=='black_cotton', 1.25, np.where(soil_types=='alluvial', 1.15, np.where(soil_types=='red_laterite', 0.88, 0.65)))
    soil_encoded= np.where(soil_types=='black_cotton', 3, np.where(soil_types=='alluvial', 2, np.where(soil_types=='red_laterite', 1, 0)))

    season_month = np.random.randint(1, 13, n)
    is_kharif    = (season_month >= 6) & (season_month <= 10)
    is_rabi      = (season_month >= 11) | (season_month <= 3)

    ndvi = np.where(is_kharif, np.random.uniform(0.55,0.95,n),
           np.where(is_rabi,   np.random.uniform(0.35,0.75,n),
                               np.random.uniform(0.10,0.42,n)))
    ndvi = np.clip(ndvi * np.random.uniform(0.85,1.15,n), 0.05, 0.98)

    base_moisture = np.where(is_kharif, np.random.uniform(58,90,n),
                    np.where(is_rabi,   np.random.uniform(32,68,n),
                                        np.random.uniform(14,38,n)))
    irr_boost = has_irrigation * np.where(is_kharif, np.random.uniform(0,5,n),
                                 np.where(is_rabi,   np.random.uniform(8,20,n),
                                                     np.random.uniform(15,30,n)))
    moisture = np.clip(base_moisture + irr_boost, 10, 95)

    temperature = np.where(is_kharif, np.random.uniform(24,36,n),
                  np.where(is_rabi,   np.random.uniform(18,30,n),
                                      np.random.uniform(32,44,n)))

    biomass_c = ndvi * area * 3.67 * (months/12)
    soil_c    = soc  * area * 0.58 * (months/12) * 0.3
    bonus     = np.where(practice==3, 0.35*area*(months/12),
                np.where(practice==2, 0.28*notill_maturity*area*(months/12),
                np.where(practice==1, 0.15*area*(months/12), 0)))

    mf = np.clip((moisture-10)/80, 0.1, 1.0)
    tf = np.where(temperature>40, 0.60, np.where(temperature>38, 0.72, np.where(temperature>35, 0.85, 1.0)))
    sf = np.clip(0.65+(area/25)*0.35, 0.65, 1.0)

    co2_base  = (biomass_c + soil_c + bonus) * mf * tf * sf * soil_factor
    noise_pct = np.where(area<1.0, 0.18, np.where(area<3.0, 0.12, np.where(area<7.0, 0.08, 0.05)))
    co2       = np.clip(co2_base + np.random.normal(0,noise_pct,n)*co2_base, 0.05, None)

    return pd.DataFrame({
        "ndvi":ndvi,"area_hectares":area,"soil_organic_carbon":soc,
        "temperature_avg":temperature,"soil_moisture_avg":moisture,
        "monitoring_months":months,"practice_encoded":practice,
        "practice_years":practice_years,"soil_type_encoded":soil_encoded,
        "has_irrigation":has_irrigation,"season_month":season_month.astype(float),
        "co2_tons":co2,
    })

print("="*60)
print("GreenLedger Carbon Estimation Model v3.0")
print("="*60)
print("\nGenerating 4000 realistic Maharashtra farm samples...")
df = generate(4000)
print(f"  CO2 range  : {df.co2_tons.min():.2f} - {df.co2_tons.max():.2f} tonnes")
print(f"  CO2 mean   : {df.co2_tons.mean():.2f} tonnes")

FEATURES = ["ndvi","area_hectares","soil_organic_carbon","temperature_avg",
            "soil_moisture_avg","monitoring_months","practice_encoded",
            "practice_years","soil_type_encoded","has_irrigation","season_month"]

X,y    = df[FEATURES].values, df["co2_tons"].values
Xtr,Xte,ytr,yte = train_test_split(X, y, test_size=0.2, random_state=SEED)
scaler = StandardScaler()
Xtr_s  = scaler.fit_transform(Xtr)
Xte_s  = scaler.transform(Xte)

print("\nTraining Random Forest (300 trees, 11 features)...")
rf = RandomForestRegressor(n_estimators=300, max_depth=16, min_samples_leaf=2,
                           min_samples_split=4, max_features='sqrt', random_state=SEED, n_jobs=-1)
rf.fit(Xtr_s, ytr)
rf_pred = rf.predict(Xte_s)
rf_mae  = mean_absolute_error(yte, rf_pred)
rf_r2   = r2_score(yte, rf_pred)
rf_rmse = np.sqrt(mean_squared_error(yte, rf_pred))
print(f"  Random Forest  -> MAE={rf_mae:.3f}  R2={rf_r2:.4f}  RMSE={rf_rmse:.3f}")

print("Training Gradient Boosting (200 trees)...")
gb = GradientBoostingRegressor(n_estimators=200, max_depth=6, learning_rate=0.05, min_samples_leaf=3, random_state=SEED)
gb.fit(Xtr_s, ytr)
gb_pred = gb.predict(Xte_s)
gb_mae  = mean_absolute_error(yte, gb_pred)
gb_r2   = r2_score(yte, gb_pred)
print(f"  Gradient Boost -> MAE={gb_mae:.3f}  R2={gb_r2:.4f}")

best_model = rf if rf_r2>=gb_r2 else gb
best_name  = "Random Forest" if rf_r2>=gb_r2 else "Gradient Boosting"
best_mae   = rf_mae if rf_r2>=gb_r2 else gb_mae
best_r2    = rf_r2 if rf_r2>=gb_r2 else gb_r2

print(f"\nFeature importance ({best_name}):")
for f,imp in sorted(zip(FEATURES, best_model.feature_importances_), key=lambda x:-x[1]):
    print(f"  {f:25s} {'█'*int(imp*50)} {imp:.3f}")

print("\n5-fold cross validation...")
cv = cross_val_score(best_model, Xtr_s, ytr, cv=5, scoring='r2')
print(f"  CV R2: {[round(s,4) for s in cv]}  mean={cv.mean():.4f}")

print("\nMAE by farm size:")
for label,lo,hi in [("Tiny (<1ha)",0,1),("Small (1-2ha)",1,2),("Medium (2-5ha)",2,5),("Large (>5ha)",5,999)]:
    mask=(Xte[:,1]>=lo)&(Xte[:,1]<hi)
    if mask.sum()>5:
        print(f"  {label:20s} n={mask.sum():4d}  MAE={mean_absolute_error(yte[mask],best_model.predict(Xte_s[mask])):.3f}")

DIR = os.path.dirname(os.path.abspath(__file__))
joblib.dump(best_model, os.path.join(DIR,"carbon_model.pkl"))
joblib.dump(scaler,     os.path.join(DIR,"scaler.pkl"))
joblib.dump(FEATURES,   os.path.join(DIR,"features.pkl"))

print(f"\n{'='*60}")
print(f"FINAL: {best_name}  MAE={best_mae:.3f}  R2={best_r2:.4f}  RMSE={rf_rmse:.3f}")
print(f"Features: {len(FEATURES)}  Samples: 4000")
print(f"Saved to: {DIR}/")
print(f"{'='*60}")
