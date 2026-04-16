"""
GreenLedger Carbon Predictor v3.0
Loads trained model and makes predictions.
Supports both old (7 features) and new (11 features) models.
"""
import numpy as np
import joblib, os

_DIR    = os.path.dirname(os.path.abspath(__file__))
_model  = None
_scaler = None
_features = None

PRACTICE = {"conventional":0,"cover_crop":1,"no_till":2,"agroforestry":3}
SOIL_TYPE = {"black_cotton":3,"alluvial":2,"red_laterite":1,"shallow_rocky":0}

def _load():
    global _model, _scaler, _features
    if _model is None:
        mp = os.path.join(_DIR,"carbon_model.pkl")
        sp = os.path.join(_DIR,"scaler.pkl")
        fp = os.path.join(_DIR,"features.pkl")
        if not os.path.exists(mp):
            raise FileNotFoundError("Model not found. Run: python model/train_model.py")
        _model  = joblib.load(mp)
        _scaler = joblib.load(sp)
        _features = joblib.load(fp) if os.path.exists(fp) else None

def predict(ndvi, area_hectares, soil_organic_carbon,
            temperature_avg=28.0, soil_moisture_avg=55.0,
            monitoring_months=6, practice="conventional",
            practice_years=3, soil_type="black_cotton",
            has_irrigation=1, season_month=8):
    _load()

    prac_enc = float(PRACTICE.get(practice, 0))
    soil_enc = float(SOIL_TYPE.get(soil_type, 3))

    # Build feature vector based on what the model expects
    if _features and len(_features) == 11:
        # New v3 model with 11 features
        X = np.array([[
            float(ndvi), float(area_hectares), float(soil_organic_carbon),
            float(temperature_avg), float(soil_moisture_avg),
            float(monitoring_months), prac_enc,
            float(practice_years), soil_enc,
            float(has_irrigation), float(season_month)
        ]])
    else:
        # Old v2 model with 7 features
        X = np.array([[
            float(ndvi), float(area_hectares), float(soil_organic_carbon),
            float(temperature_avg), float(soil_moisture_avg),
            float(monitoring_months), prac_enc
        ]])

    Xs    = _scaler.transform(X)
    preds = np.array([t.predict(Xs)[0] for t in _model.estimators_])
    co2   = float(max(0, np.mean(preds)))
    std   = float(np.std(preds))
    conf  = max(0.0, round(100-(std/(co2+1e-6))*100, 1))

    return {
        "co2_tons":   round(co2, 3),
        "credits":    int(co2),
        "confidence": conf,
        "std_dev":    round(std, 3)
    }
