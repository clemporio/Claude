import type { RawPost, Platform } from '../types';

// --- Core Data Model ---

export type Region = 'US' | 'CA' | 'UK' | 'IE' | 'IN' | 'AU' | 'GLOBAL';
export type Sport = 'nba' | 'nhl' | 'nfl' | 'mlb' | 'football' | 'cricket' | 'tennis' | 'mma' | 'boxing' | 'horse_racing' | 'general';

export interface AudienceProfile {
  sport: Sport;
  regions: Region[];
  peakHoursUTC: number[];       // Hours when this audience is most active
  terminology: Record<string, string>;  // e.g. "football" vs "soccer"
  subreddits: string[];
  twitterKeywords: string[];
  twitterHashtags: string[];
  forumAffinity: string[];      // Which forums this audience uses
  culturalNotes: string;        // Guidance for the drafter
}

// --- Audience Profiles ---

const AUDIENCES: Record<Sport, AudienceProfile> = {
  nba: {
    sport: 'nba',
    regions: ['US', 'CA'],
    peakHoursUTC: [0, 1, 2, 3, 22, 23],  // 6pm-10pm ET = 22-03 UTC
    terminology: {
      'betting': 'betting',
      'accumulator': 'parlay',
      'odds': 'odds',
      'draw': 'push',
      'match': 'game',
      'pitch': 'court',
      'fixture': 'game',
      'punter': 'bettor',
      'bookmaker': 'sportsbook',
      'favourite': 'favorite',
    },
    subreddits: ['nba', 'sportsbook', 'sportsbetting', 'NBAbetting', 'fantasybball'],
    twitterKeywords: ['NBA picks', 'NBA betting', 'NBA props', 'NBA player props', 'NBA parlay', 'NBA best bets', 'NBA model'],
    twitterHashtags: ['NBABets', 'NBAPicks', 'NBAProps', 'NBAParlay', 'NBAGamblingTwitter'],
    forumAffinity: ['Covers', 'ActionNetwork'],
    culturalNotes: `Audience is American/Canadian. Use "parlay" not "accumulator", "sportsbook" not "bookmaker", "game" not "match". Reference the NBA season schedule, playoffs, specific teams. Americans are familiar with prop bets, player props, over/unders. Don't use British slang like "punter" or "acca". Mentioning specific stats (PER, usage rate, pace) signals credibility.`,
  },

  nhl: {
    sport: 'nhl',
    regions: ['US', 'CA'],
    peakHoursUTC: [0, 1, 2, 23],  // 7pm-9pm ET
    terminology: {
      'accumulator': 'parlay',
      'match': 'game',
      'punter': 'bettor',
      'bookmaker': 'sportsbook',
      'favourite': 'favorite',
    },
    subreddits: ['hockey', 'sportsbook', 'sportsbetting', 'nhl'],
    twitterKeywords: ['NHL picks', 'NHL betting', 'hockey picks', 'NHL best bets', 'NHL props', 'puck line'],
    twitterHashtags: ['NHLBets', 'NHLPicks', 'HockeyBetting', 'NHLProps'],
    forumAffinity: ['Covers'],
    culturalNotes: `Audience is North American, skewing Canadian. Puck line is the hockey equivalent of spread. Canadians are passionate — reference specific teams/rivalries. Moneyline betting is most common in hockey. Mention goalie matchups, back-to-backs, and travel schedules as factors — that signals you know the sport.`,
  },

  nfl: {
    sport: 'nfl',
    regions: ['US'],
    peakHoursUTC: [17, 18, 19, 20, 21, 22, 23, 0, 1],  // Sunday-Monday game windows
    terminology: {
      'accumulator': 'parlay',
      'match': 'game',
      'punter': 'bettor',
      'bookmaker': 'sportsbook',
      'favourite': 'favorite',
    },
    subreddits: ['sportsbook', 'sportsbetting', 'nfl', 'fantasyfootball'],
    twitterKeywords: ['NFL picks', 'NFL betting', 'NFL spread', 'NFL parlay', 'NFL best bets', 'NFL props', 'Sunday picks'],
    twitterHashtags: ['NFLBets', 'NFLPicks', 'NFLParlay', 'NFLProps', 'SundaySlate'],
    forumAffinity: ['Covers', 'ActionNetwork'],
    culturalNotes: `Audience is American. NFL is king of American sports betting. Spread betting dominates. Reference ATS records, injury reports, weather for outdoor games. Fantasy football crossover audience is huge — many fantasy players also bet. "Fade the public" resonates. Don't use any British terminology.`,
  },

  mlb: {
    sport: 'mlb',
    regions: ['US'],
    peakHoursUTC: [22, 23, 0, 1, 2],  // Evening games ET
    terminology: {
      'accumulator': 'parlay',
      'match': 'game',
      'punter': 'bettor',
      'bookmaker': 'sportsbook',
      'favourite': 'favorite',
    },
    subreddits: ['sportsbook', 'sportsbetting', 'baseball'],
    twitterKeywords: ['MLB picks', 'MLB betting', 'MLB best bets', 'MLB model', 'baseball picks'],
    twitterHashtags: ['MLBBets', 'MLBPicks', 'MLBParlay', 'BaseballBetting'],
    forumAffinity: ['Covers'],
    culturalNotes: `Audience is American. MLB is a data-heavy sport — sabermetrics, ERA, WHIP, xFIP. Pitcher matchups drive the market. Run line = spread. Reference starting pitchers and bullpen usage. Data-driven approach resonates strongly with baseball bettors.`,
  },

  football: {
    sport: 'football',
    regions: ['UK', 'IE'],
    peakHoursUTC: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21],  // UK afternoon/evening
    terminology: {
      'parlay': 'accumulator',
      'sportsbook': 'bookmaker',
      'bettor': 'punter',
      'soccer': 'football',
      'game': 'match',
      'favorite': 'favourite',
      'offense': 'attack',
      'roster': 'squad',
      'field': 'pitch',
      'overtime': 'extra time',
    },
    subreddits: ['soccer', 'soccerbetting', 'bettingadvice', 'football', 'PremierLeague', 'Championship'],
    twitterKeywords: ['football tips', 'football betting', 'acca tips', 'football accumulators', 'both teams to score', 'BTTS', 'over 2.5 goals', 'football picks', 'EPL tips'],
    twitterHashtags: ['FootballTips', 'AccaTips', 'BTTS', 'BettingTips', 'PremierLeague', 'FPL'],
    forumAffinity: ['OLBG', 'PuntersLounge', 'BettingExpert'],
    culturalNotes: `Audience is British and Irish. Say "football" NEVER "soccer". Say "accumulator" or "acca" NEVER "parlay". Say "bookmaker" or "bookie" NEVER "sportsbook". Say "punter" NEVER "bettor". BTTS (both teams to score), over/under goals, and accas are the bread and butter. Reference the Premier League, Championship, Champions League. Saturday 3pm kickoffs are sacred. Understand that UK/Irish betting culture is deeply embedded — these people bet weekly, they know the landscape. Don't explain basics. Matched betting, Bet365, Paddy Power, William Hill, Sky Bet are household names.`,
  },

  cricket: {
    sport: 'cricket',
    regions: ['IN', 'UK', 'AU'],
    peakHoursUTC: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],  // IST afternoon = UTC morning, plus UK daytime for English cricket
    terminology: {
      'parlay': 'accumulator',
      'game': 'match',
      'bettor': 'punter',
    },
    subreddits: ['Cricket', 'CricketBetting', 'IPL'],
    twitterKeywords: ['cricket betting', 'IPL picks', 'cricket tips', 'IPL betting', 'cricket predictions', 'T20 betting', 'test match betting'],
    twitterHashtags: ['CricketBetting', 'IPL', 'IPLBetting', 'CricketTips', 'T20', 'CricketPredictions'],
    forumAffinity: ['OLBG', 'BettingExpert'],
    culturalNotes: `Audience is primarily Indian, with English and Australian segments. For Indian audience: IPL is massive, T20 format dominates interest. Reference specific IPL teams and players. Hindi-English code-switching is common but draft in English. For English audience: County cricket, The Ashes, test matches. Cricket betting in India is a huge market but legally grey — be aware of this context. Stats like batting average, strike rate, economy rate signal credibility. Pitch conditions and toss outcomes are major betting factors.`,
  },

  tennis: {
    sport: 'tennis',
    regions: ['GLOBAL'],
    peakHoursUTC: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],  // Wide window — tournaments span timezones
    terminology: {},  // Tennis terminology is universal
    subreddits: ['tennis', 'sportsbook', 'sportsbetting'],
    twitterKeywords: ['tennis picks', 'tennis betting', 'tennis tips', 'ATP picks', 'WTA picks', 'grand slam betting', 'tennis model'],
    twitterHashtags: ['TennisBetting', 'TennisPicks', 'ATP', 'WTA', 'GrandSlam', 'TennisTips'],
    forumAffinity: ['Covers', 'OLBG', 'BettingExpert'],
    culturalNotes: `Audience is global — no single region dominates. Tennis betting is popular because of the volume of matches and live/in-play opportunities. Surface type (clay/hard/grass) is a major factor. Head-to-head records, recent form, and fatigue from tournament schedules are key. Reference specific tournaments (Grand Slams, Masters 1000). Tennis is the most data-friendly betting sport after baseball — models work well here. Use neutral English, avoid regional slang.`,
  },

  mma: {
    sport: 'mma',
    regions: ['US', 'GLOBAL'],
    peakHoursUTC: [2, 3, 4, 5],  // UFC main cards late ET
    terminology: {
      'accumulator': 'parlay',
      'bookmaker': 'sportsbook',
      'match': 'fight',
    },
    subreddits: ['MMA', 'ufc', 'sportsbook', 'MMAbetting'],
    twitterKeywords: ['UFC picks', 'MMA betting', 'UFC best bets', 'UFC parlay', 'fight picks'],
    twitterHashtags: ['UFCBets', 'UFCPicks', 'MMABetting', 'FightNight'],
    forumAffinity: ['Covers'],
    culturalNotes: `Audience skews American but MMA is global. Use "fight" not "match". Reference specific UFC events by number. Prop bets (method of victory, round betting) are popular. Wrestling vs striking matchups are the core analysis. Mention weight cuts, reach advantages, stylistic matchups to signal credibility.`,
  },

  boxing: {
    sport: 'boxing',
    regions: ['US', 'UK', 'GLOBAL'],
    peakHoursUTC: [2, 3, 4, 5, 22, 23],  // Big fights late evening in US or UK
    terminology: {},
    subreddits: ['Boxing', 'sportsbook'],
    twitterKeywords: ['boxing picks', 'boxing betting', 'fight picks', 'boxing odds'],
    twitterHashtags: ['BoxingBets', 'BoxingPicks', 'FightNight'],
    forumAffinity: ['Covers', 'OLBG'],
    culturalNotes: `Mixed US/UK audience. Boxing betting is event-driven — big fight weeks are the opportunity windows. Reference specific fights and fighters. Method of victory and round betting are popular props. UK boxing scene (Sky Sports, DAZN) and US scene (ESPN, Showtime) are somewhat separate audiences.`,
  },

  horse_racing: {
    sport: 'horse_racing',
    regions: ['UK', 'IE', 'AU'],
    peakHoursUTC: [10, 11, 12, 13, 14, 15, 16],  // UK/Irish race times
    terminology: {
      'bettor': 'punter',
      'sportsbook': 'bookmaker',
    },
    subreddits: ['horseracing', 'HorseRacingUK'],
    twitterKeywords: ['racing tips', 'horse racing tips', 'NAP of the day', 'Cheltenham tips', 'each way', 'horse racing picks'],
    twitterHashtags: ['RacingTips', 'HorseRacing', 'NAP', 'Cheltenham', 'Ascot', 'EachWay'],
    forumAffinity: ['OLBG', 'PuntersLounge', 'BettingExpert'],
    culturalNotes: `Audience is British, Irish, and Australian. Horse racing is deeply cultural in UK/IE — Cheltenham Festival, Grand National, Royal Ascot are national events. "NAP" means best bet of the day. "Each way" betting is fundamental. Reference going (ground conditions), trainer/jockey combinations, course form. This audience is the most experienced betting demographic — they know their stuff. Don't be patronising. Irish audience in particular is extremely knowledgeable about racing.`,
  },

  general: {
    sport: 'general',
    regions: ['GLOBAL'],
    peakHoursUTC: Array.from({ length: 24 }, (_, i) => i),
    terminology: {},
    subreddits: ['sportsbook', 'sportsbetting', 'gambling', 'bettingadvice'],
    twitterKeywords: ['betting signals', 'sports picks', 'betting tips', 'free picks', 'betting discord', 'betting community'],
    twitterHashtags: ['SportsBetting', 'BettingTips', 'FreePicks', 'GamblingTwitter', 'BettingCommunity'],
    forumAffinity: ['Covers', 'OLBG', 'BettingExpert'],
    culturalNotes: `General sports betting audience. Use neutral English. Don't assume regional terminology — if unsure, use the most universally understood term.`,
  },
};

// --- Sport Detection ---

const SPORT_SIGNALS: Record<Sport, string[]> = {
  nba: ['nba', 'basketball', 'lakers', 'celtics', 'warriors', 'bucks', 'player props', 'nba picks', 'nba betting', 'nba parlay', 'lebron', 'steph curry', 'doncic', 'jokic'],
  nhl: ['nhl', 'hockey', 'puck line', 'nhl picks', 'nhl betting', 'maple leafs', 'canadiens', 'bruins', 'oilers', 'connor mcdavid'],
  nfl: ['nfl', 'football picks', 'sunday slate', 'nfl spread', 'nfl parlay', 'touchdowns', 'quarterback', 'nfl props', 'fantasy football', 'mahomes', 'super bowl'],
  mlb: ['mlb', 'baseball', 'run line', 'mlb picks', 'pitcher', 'batting average', 'era', 'whip', 'yankees', 'dodgers'],
  football: ['premier league', 'epl', 'championship', 'la liga', 'serie a', 'bundesliga', 'champions league', 'btts', 'both teams to score', 'acca', 'accumulator', 'over 2.5', 'under 2.5', 'anytime scorer', 'football tips', 'football betting', 'fpl', 'goalkeeper', 'striker', 'midfielder', 'arsenal', 'liverpool', 'man city', 'man united', 'chelsea', 'tottenham'],
  cricket: ['cricket', 'ipl', 'test match', 'ashes', 't20', 'odi', 'batting', 'bowling', 'wicket', 'innings', 'run rate', 'virat kohli', 'sachin'],
  tennis: ['tennis', 'atp', 'wta', 'grand slam', 'wimbledon', 'french open', 'us open', 'australian open', 'djokovic', 'alcaraz', 'sinner', 'nadal', 'federer', 'match point', 'set betting', 'break of serve'],
  mma: ['ufc', 'mma', 'fight night', 'octagon', 'knockout', 'submission', 'tko', 'decision', 'ppv', 'dana white', 'weight class'],
  boxing: ['boxing', 'heavyweight', 'middleweight', 'knockout', 'rounds', 'undercard', 'main event', 'fury', 'usyk', 'canelo'],
  horse_racing: ['horse racing', 'racing tips', 'cheltenham', 'grand national', 'ascot', 'nap', 'each way', 'going', 'trainer', 'jockey', 'furlong', 'handicap', 'flat racing', 'national hunt'],
  general: [],
};

// --- Region Detection ---

const REGION_SIGNALS: Record<Region, string[]> = {
  US: ['sportsbook', 'parlay', 'prop bet', 'spread', 'moneyline', 'vegas', 'fanduel', 'draftkings', 'betmgm', 'caesars', 'barstool', 'espn bet', 'american', 'usa', 'nfl', 'nba', 'mlb'],
  CA: ['proline', 'canada', 'canadian', 'maple leafs', 'raptors', 'bet365 canada', 'ontario'],
  UK: ['acca', 'accumulator', 'punter', 'bookie', 'bookmaker', 'bet365', 'paddy power', 'william hill', 'sky bet', 'betfair', 'ladbrokes', 'coral', 'premier league', 'championship', 'fa cup', 'epl', 'football tips', 'btts'],
  IE: ['paddy power', 'boylesports', 'irish', 'ireland', 'cheltenham', 'leopardstown', 'gaelic', 'gaa'],
  IN: ['ipl', 'cricket', 'india', 'indian', 'rupee', 'dream11', 'betway india', 'paytm', 'mumbai indians', 'chennai super kings', 'virat', 'dhoni'],
  AU: ['australia', 'australian', 'sportsbet', 'tab', 'neds', 'ladbrokes au', 'melbourne cup', 'afl', 'nrl', 'a-league'],
  GLOBAL: [],
};

// --- Detection Functions ---

export function detectSports(post: RawPost): Sport[] {
  const text = `${post.title} ${post.body}`.toLowerCase();
  const detected: { sport: Sport; confidence: number }[] = [];

  for (const [sport, signals] of Object.entries(SPORT_SIGNALS)) {
    if (sport === 'general') continue;
    let matches = 0;
    for (const signal of signals) {
      if (text.includes(signal)) matches++;
    }
    if (matches > 0) {
      detected.push({ sport: sport as Sport, confidence: matches });
    }
  }

  if (detected.length === 0) return ['general'];

  // Sort by confidence, return all detected sports
  detected.sort((a, b) => b.confidence - a.confidence);
  return detected.map(d => d.sport);
}

export function detectRegions(post: RawPost): Region[] {
  const text = `${post.title} ${post.body}`.toLowerCase();
  const detected: { region: Region; confidence: number }[] = [];

  for (const [region, signals] of Object.entries(REGION_SIGNALS)) {
    if (region === 'GLOBAL') continue;
    let matches = 0;
    for (const signal of signals) {
      if (text.includes(signal)) matches++;
    }
    if (matches > 0) {
      detected.push({ region: region as Region, confidence: matches });
    }
  }

  if (detected.length === 0) return ['GLOBAL'];
  detected.sort((a, b) => b.confidence - a.confidence);
  return detected.map(d => d.region);
}

export function getAudienceProfile(sport: Sport): AudienceProfile {
  return AUDIENCES[sport] || AUDIENCES.general;
}

export function getAllProfiles(): Record<Sport, AudienceProfile> {
  return AUDIENCES;
}

// --- Audience Score ---

export interface AudienceScore {
  sportMatch: Sport[];
  regionMatch: Region[];
  timingScore: number;       // 0-15: is the target audience likely online right now?
  terminologyFit: number;    // 0-10: does the post use region-appropriate language?
  total: number;             // 0-25 bonus points added to opportunity score
  audienceNotes: string;     // Summary for the drafter
}

export function scoreAudience(post: RawPost): AudienceScore {
  const sports = detectSports(post);
  const regions = detectRegions(post);
  const primarySport = sports[0];
  const profile = getAudienceProfile(primarySport);

  // Timing: is this post's audience likely active right now?
  const currentHourUTC = new Date().getUTCHours();
  const timingScore = profile.peakHoursUTC.includes(currentHourUTC) ? 15 : 5;

  // Terminology fit: does the post's language match the expected audience?
  const text = `${post.title} ${post.body}`.toLowerCase();
  let termMatches = 0;
  const termValues = Object.values(profile.terminology);
  for (const term of termValues) {
    if (text.includes(term.toLowerCase())) termMatches++;
  }
  const terminologyFit = Math.min(10, termMatches * 3);

  // Build audience notes for the drafter
  const regionNames = regions.map(r => {
    const names: Record<Region, string> = {
      US: 'American', CA: 'Canadian', UK: 'British',
      IE: 'Irish', IN: 'Indian', AU: 'Australian', GLOBAL: 'global',
    };
    return names[r];
  }).join('/');

  const audienceNotes = `Detected sport(s): ${sports.join(', ')}. Target audience: ${regionNames}. ${profile.culturalNotes}`;

  return {
    sportMatch: sports,
    regionMatch: regions,
    timingScore,
    terminologyFit,
    total: timingScore + terminologyFit,
    audienceNotes,
  };
}

// --- Terminology Translation ---

export function localiseText(text: string, targetSport: Sport): string {
  const profile = getAudienceProfile(targetSport);
  let result = text;

  for (const [from, to] of Object.entries(profile.terminology)) {
    // Case-insensitive replacement preserving first-letter case
    const regex = new RegExp(`\\b${from}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      if (match[0] === match[0].toUpperCase()) {
        return to.charAt(0).toUpperCase() + to.slice(1);
      }
      return to;
    });
  }

  return result;
}

// --- Aggregated Scan Targets ---

export function getActiveSubreddits(): string[] {
  const subs = new Set<string>();
  for (const profile of Object.values(AUDIENCES)) {
    for (const sub of profile.subreddits) {
      subs.add(sub);
    }
  }
  return Array.from(subs);
}

export function getActiveTwitterKeywords(): string[] {
  const kws = new Set<string>();
  for (const profile of Object.values(AUDIENCES)) {
    for (const kw of profile.twitterKeywords) {
      kws.add(kw);
    }
  }
  return Array.from(kws);
}

export function getActiveTwitterHashtags(): string[] {
  const tags = new Set<string>();
  for (const profile of Object.values(AUDIENCES)) {
    for (const tag of profile.twitterHashtags) {
      tags.add(tag);
    }
  }
  return Array.from(tags);
}

// --- Time-Aware Scanning ---

export function getSportsActiveNow(): Sport[] {
  const hour = new Date().getUTCHours();
  const active: Sport[] = [];

  for (const [sport, profile] of Object.entries(AUDIENCES)) {
    if (sport === 'general') continue;
    if (profile.peakHoursUTC.includes(hour)) {
      active.push(sport as Sport);
    }
  }

  return active.length > 0 ? active : ['general'];
}

export function getPrioritySubredditsNow(): string[] {
  const activeSports = getSportsActiveNow();
  const subs = new Set<string>();

  for (const sport of activeSports) {
    const profile = getAudienceProfile(sport);
    for (const sub of profile.subreddits) {
      subs.add(sub);
    }
  }

  // Always include general betting subs
  for (const sub of AUDIENCES.general.subreddits) {
    subs.add(sub);
  }

  return Array.from(subs);
}
