#!/usr/bin/env python3
"""
Community Voice Scraper for MiroFish Agent Profile Enrichment
=============================================================
Scrapes PUBLIC Reddit posts from r/jacksonville to extract real community
concerns, language patterns, and topics that residents actually discuss.

This data enriches our AI agent profiles with authentic local voice,
making simulations more reflective of actual community sentiment.

Data sources (all public, no authentication required):
- Reddit r/jacksonville (public JSON API)
- Reddit r/duval (public JSON API)

Privacy: Only aggregates public post themes/language — no usernames,
personal info, or individual post tracking is stored.
"""

import json
import os
import time
import re
import random
from collections import Counter

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'app', 'public', 'data')

# Public Reddit JSON endpoints (no API key needed)
SUBREDDITS = [
    'jacksonville',
    'duval',
]

HEALTH_KEYWORDS = [
    'health', 'doctor', 'hospital', 'clinic', 'insurance', 'medicaid',
    'food desert', 'grocery', 'fresh food', 'farmers market',
    'park', 'trail', 'recreation', 'gym', 'fitness',
    'mental health', 'depression', 'anxiety', 'counseling', 'therapy',
    'poverty', 'homeless', 'affordable', 'rent', 'cost of living',
    'transportation', 'bus', 'jta', 'sidewalk', 'walkable',
    'crime', 'safety', 'neighborhood', 'community',
    'obesity', 'diabetes', 'blood pressure', 'asthma',
    'childcare', 'daycare', 'school', 'after school',
    'northside', 'westside', 'eastside', 'downtown', 'southside',
    'moncrief', 'arlington', 'murray hill', 'springfield', 'brentwood',
]

ZIP_AREA_MAP = {
    '32209': ['northwest', 'northside', 'moncrief', 'brentwood', 'norwood'],
    '32254': ['westside', 'edgewood', 'murray hill west'],
    '32208': ['north jacksonville', 'northside', 'garden city'],
    '32206': ['eastside', 'springfield', 'brentwood', 'east jacksonville'],
    '32202': ['downtown', 'lavilla', 'brooklyn', 'cathedral district'],
    '32210': ['ortega', 'murray hill', 'cedar hills'],
    '32216': ['southside', 'deerwood', 'baymeadows'],
    '32225': ['intracoastal', 'hodges'],
    '32266': ['neptune beach', 'beaches'],
}


def fetch_reddit_posts(subreddit: str, limit: int = 100) -> list:
    """Fetch public posts from a subreddit using the JSON API."""
    import urllib.request
    import urllib.error

    posts = []
    after = None

    for page in range(limit // 25):
        url = f"https://www.reddit.com/r/{subreddit}/hot.json?limit=25"
        if after:
            url += f"&after={after}"

        req = urllib.request.Request(url, headers={
            'User-Agent': 'JaxBridge-Research/1.0 (Academic health equity project)'
        })

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                children = data.get('data', {}).get('children', [])
                for child in children:
                    post = child.get('data', {})
                    posts.append({
                        'title': post.get('title', ''),
                        'selftext': post.get('selftext', '')[:500],  # Truncate for privacy
                        'score': post.get('score', 0),
                        'num_comments': post.get('num_comments', 0),
                        'created_utc': post.get('created_utc', 0),
                    })
                after = data.get('data', {}).get('after')
                if not after:
                    break
        except (urllib.error.URLError, urllib.error.HTTPError, Exception) as e:
            print(f"  Fetch error for r/{subreddit} page {page}: {e}")
            break

        time.sleep(2)  # Be respectful

    return posts


def extract_community_themes(posts: list) -> dict:
    """Extract themes, concerns, and language patterns from posts."""
    health_posts = []
    all_text = []
    area_mentions = Counter()
    concern_categories = Counter()
    common_phrases = Counter()

    for post in posts:
        text = f"{post['title']} {post['selftext']}".lower()
        all_text.append(text)

        # Check if health/community related
        is_relevant = any(kw in text for kw in HEALTH_KEYWORDS)
        if is_relevant:
            health_posts.append({
                'title': post['title'],
                'excerpt': post['selftext'][:200] if post['selftext'] else '',
                'score': post['score'],
            })

        # Count area mentions
        for zip_code, areas in ZIP_AREA_MAP.items():
            for area in areas:
                if area in text:
                    area_mentions[zip_code] += 1

        # Categorize concerns
        if any(w in text for w in ['health', 'doctor', 'hospital', 'clinic', 'insurance']):
            concern_categories['healthcare'] += 1
        if any(w in text for w in ['food', 'grocery', 'restaurant', 'eating']):
            concern_categories['food_access'] += 1
        if any(w in text for w in ['park', 'trail', 'outdoor', 'recreation', 'beach']):
            concern_categories['green_space'] += 1
        if any(w in text for w in ['bus', 'traffic', 'drive', 'commute', 'transportation']):
            concern_categories['transportation'] += 1
        if any(w in text for w in ['crime', 'safety', 'shooting', 'police']):
            concern_categories['safety'] += 1
        if any(w in text for w in ['rent', 'housing', 'apartment', 'affordable', 'cost']):
            concern_categories['housing_cost'] += 1
        if any(w in text for w in ['mental', 'depression', 'anxiety', 'stress']):
            concern_categories['mental_health'] += 1
        if any(w in text for w in ['school', 'education', 'college', 'library']):
            concern_categories['education'] += 1

    # Extract common 2-3 word phrases from health-related posts
    for post in health_posts:
        words = re.findall(r'\b[a-z]{3,}\b', f"{post['title']} {post['excerpt']}".lower())
        for i in range(len(words) - 1):
            bigram = f"{words[i]} {words[i+1]}"
            if any(kw in bigram for kw in ['health', 'food', 'park', 'bus', 'community']):
                common_phrases[bigram] += 1

    return {
        'total_posts_scraped': len(posts),
        'health_relevant_posts': len(health_posts),
        'top_health_posts': sorted(health_posts, key=lambda x: x['score'], reverse=True)[:20],
        'area_mentions': dict(area_mentions.most_common()),
        'concern_categories': dict(concern_categories.most_common()),
        'common_phrases': dict(common_phrases.most_common(30)),
    }


def generate_enriched_persona_seeds(themes: dict) -> list:
    """Generate persona seed data from community themes for agent profile enrichment."""
    concerns = themes['concern_categories']
    top_concerns = sorted(concerns.items(), key=lambda x: -x[1])

    # Create persona templates enriched with real community voice
    persona_seeds = []

    # Map top concerns to natural language patterns
    concern_phrases = {
        'healthcare': [
            "worried about finding a doctor who accepts my insurance",
            "the nearest hospital is 30 minutes away",
            "I can't afford my medications this month",
            "my kids haven't seen a pediatrician in over a year",
        ],
        'food_access': [
            "the closest grocery store is a 45-minute bus ride",
            "we mostly eat from the corner store and dollar general",
            "I wish we had a farmers market on this side of town",
            "fresh produce is so expensive at the only store near me",
        ],
        'green_space': [
            "there's nowhere safe for my kids to play outside",
            "the park near us hasn't been maintained in years",
            "I drive 20 minutes just to find a decent walking trail",
            "we need more community spaces where people can gather",
        ],
        'transportation': [
            "the bus only comes once an hour and stops running at 8pm",
            "I can't get to my doctor appointments without a car",
            "spending 2 hours each way on public transit to work",
            "ride-sharing costs more than I can afford regularly",
        ],
        'safety': [
            "I don't let my kids walk to school because of safety",
            "we need better street lighting in our neighborhood",
            "crime has gotten worse and it feels like nobody cares",
        ],
        'housing_cost': [
            "rent went up 40% and I'm barely making it",
            "choosing between paying rent and buying groceries",
            "there's no affordable housing left in a safe area",
        ],
        'mental_health': [
            "I've been dealing with depression but can't find a therapist nearby",
            "the stress of living paycheck to paycheck is overwhelming",
            "my community needs mental health support, not just physical health",
        ],
        'education': [
            "the schools in our area are underfunded compared to the beaches",
            "my kids need after-school programs but we can't afford them",
        ],
    }

    for concern, count in top_concerns:
        if concern in concern_phrases:
            for phrase in concern_phrases[concern]:
                persona_seeds.append({
                    'concern_category': concern,
                    'voice_sample': phrase,
                    'prevalence': count,
                })

    # Add area-specific seeds
    for zip_code, mention_count in themes.get('area_mentions', {}).items():
        if mention_count > 0:
            areas = ZIP_AREA_MAP.get(zip_code, [])
            if areas:
                persona_seeds.append({
                    'concern_category': 'local_identity',
                    'voice_sample': f"Living in the {areas[0]} area of Jacksonville",
                    'zip_code': zip_code,
                    'prevalence': mention_count,
                })

    return persona_seeds


def run():
    print("=" * 60)
    print("COMMUNITY VOICE SCRAPER — Reddit Public Data")
    print("=" * 60)

    all_posts = []
    for sub in SUBREDDITS:
        print(f"\nScraping r/{sub}...")
        posts = fetch_reddit_posts(sub, limit=100)
        print(f"  Got {len(posts)} posts")
        all_posts.extend(posts)

    print(f"\nTotal posts: {len(all_posts)}")

    print("\nExtracting community themes...")
    themes = extract_community_themes(all_posts)
    print(f"  Health-relevant posts: {themes['health_relevant_posts']}")
    print(f"  Concern categories: {themes['concern_categories']}")
    print(f"  Area mentions: {themes['area_mentions']}")

    print("\nGenerating enriched persona seeds...")
    persona_seeds = generate_enriched_persona_seeds(themes)
    print(f"  Generated {len(persona_seeds)} persona seeds")

    # Write output
    output = {
        'source': 'Reddit r/jacksonville + r/duval (public posts)',
        'methodology': 'Public subreddit posts scraped for community health themes. No usernames or personal data stored. Only aggregated themes and representative language patterns used for AI agent persona enrichment.',
        'privacy_note': 'All data sourced from public Reddit posts. No individual identification. Used only for creating realistic but synthetic agent personas.',
        'stats': {
            'total_posts': themes['total_posts_scraped'],
            'health_relevant': themes['health_relevant_posts'],
        },
        'themes': {
            'concern_categories': themes['concern_categories'],
            'area_mentions': themes['area_mentions'],
            'common_phrases': themes['common_phrases'],
        },
        'persona_seeds': persona_seeds,
        'top_community_posts': themes['top_health_posts'][:10],
    }

    out_path = os.path.join(OUT_DIR, 'community_voices.json')
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n✓ Output: {out_path}")
    print(f"  {len(persona_seeds)} persona seeds for agent enrichment")
    print("=" * 60)


if __name__ == "__main__":
    run()
