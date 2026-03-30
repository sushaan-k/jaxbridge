#!/usr/bin/env python3
"""
Fetch Duval County ZIP code GeoJSON boundaries from Census TIGER/Line API.
Falls back to GitHub-hosted Florida ZIP codes GeoJSON if API fails.
"""

import json
import urllib.request
import os

OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'app', 'public', 'geo', 'duval_zips.geojson')
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

TARGET_ZIPS = [
    '32202', '32204', '32205', '32206', '32207', '32208', '32209',
    '32210', '32211', '32212', '32216', '32217', '32218', '32219',
    '32220', '32221', '32222', '32223', '32224', '32225', '32226',
    '32227', '32228', '32233', '32234', '32244', '32246', '32250',
    '32254', '32256', '32257', '32258', '32266', '32277',
]

def try_tigerweb():
    """Try Census TIGERweb API."""
    print("Attempting Census TIGERweb API...")
    zip_list = ",".join(f"'{z}'" for z in TARGET_ZIPS)
    url = (
        "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/2/query?"
        f"where=ZCTA5CE20+IN+({zip_list})"
        "&outFields=ZCTA5CE20,GEOID,AREALAND"
        "&returnGeometry=true"
        "&f=geojson"
        "&outSR=4326"
    )
    req = urllib.request.Request(url, headers={'User-Agent': 'JaxBridge/1.0'})
    resp = urllib.request.urlopen(req, timeout=30)
    data = json.loads(resp.read())

    if 'features' in data and len(data['features']) > 0:
        # Standardize properties
        for feat in data['features']:
            props = feat.get('properties', {})
            feat['properties'] = {
                'geoid': props.get('ZCTA5CE20', props.get('GEOID', '')),
                'arealand': props.get('AREALAND', 0),
            }
        print(f"  Got {len(data['features'])} ZIP boundaries from TIGERweb")
        return data
    return None

def try_github_fallback():
    """Try GitHub-hosted Florida ZIP codes."""
    print("Attempting GitHub fallback...")
    url = "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/fl_florida_zip_codes_geo.min.json"
    req = urllib.request.Request(url, headers={'User-Agent': 'JaxBridge/1.0'})
    resp = urllib.request.urlopen(req, timeout=30)
    data = json.loads(resp.read())

    # Filter for our target ZIPs
    filtered = {
        'type': 'FeatureCollection',
        'features': []
    }
    for feat in data.get('features', []):
        props = feat.get('properties', {})
        zipcode = props.get('ZCTA5CE10', props.get('ZCTA5CE20', props.get('ZIPCODE', '')))
        if str(zipcode) in TARGET_ZIPS:
            feat['properties'] = {
                'geoid': str(zipcode),
                'arealand': 0,
            }
            filtered['features'].append(feat)

    if len(filtered['features']) > 0:
        print(f"  Got {len(filtered['features'])} ZIP boundaries from GitHub")
        return filtered
    return None

def create_circle_fallback():
    """Create simple circle-based GeoJSON as ultimate fallback."""
    print("Creating circle marker fallback...")
    centroids = {
        '32202': [30.327, -81.655], '32204': [30.318, -81.688], '32205': [30.306, -81.718],
        '32206': [30.363, -81.640], '32207': [30.289, -81.639], '32208': [30.398, -81.680],
        '32209': [30.362, -81.700], '32210': [30.267, -81.748], '32211': [30.331, -81.590],
        '32212': [30.221, -81.689], '32216': [30.275, -81.580], '32217': [30.253, -81.622],
        '32218': [30.457, -81.651], '32219': [30.436, -81.748], '32220': [30.330, -81.820],
        '32221': [30.356, -81.783], '32222': [30.275, -81.797], '32223': [30.187, -81.645],
        '32224': [30.260, -81.510], '32225': [30.339, -81.508], '32226': [30.446, -81.508],
        '32227': [30.389, -81.421], '32228': [30.390, -81.413], '32233': [30.342, -81.418],
        '32234': [30.325, -81.900], '32244': [30.207, -81.742], '32246': [30.308, -81.526],
        '32250': [30.275, -81.401], '32254': [30.348, -81.718], '32256': [30.216, -81.542],
        '32257': [30.218, -81.590], '32258': [30.156, -81.570], '32266': [30.313, -81.414],
        '32277': [30.378, -81.575],
    }

    geojson = {
        'type': 'FeatureCollection',
        'features': []
    }

    for zipcode, [lat, lng] in centroids.items():
        geojson['features'].append({
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [lng, lat]
            },
            'properties': {
                'geoid': zipcode,
                'arealand': 0,
                'is_centroid': True,
            }
        })

    print(f"  Created {len(geojson['features'])} centroid points")
    return geojson

# Try each method in order
geojson = None
for method in [try_tigerweb, try_github_fallback, create_circle_fallback]:
    try:
        geojson = method()
        if geojson:
            break
    except Exception as e:
        print(f"  Failed: {e}")

if geojson:
    with open(OUT_PATH, 'w') as f:
        json.dump(geojson, f)
    print(f"\n✓ GeoJSON written to {OUT_PATH}")
    print(f"  Features: {len(geojson['features'])}")

    # Also copy to the root public dir
    root_out = os.path.join(os.path.dirname(__file__), '..', 'public', 'geo', 'duval_zips.geojson')
    os.makedirs(os.path.dirname(root_out), exist_ok=True)
    with open(root_out, 'w') as f:
        json.dump(geojson, f)
else:
    print("ERROR: All methods failed to produce GeoJSON")
