/**
 * Strava Integration Tools for Ailumina
 *
 * Native Ailumina tools that provide Strava API access without MCP layer.
 * Demonstrates agent-owned capabilities (third pattern alongside Skills and MCP).
 *
 * Based on the Strava skill implementation at .claude/skills/strava/
 */

import { toolFunction, ToolContext } from '../tool-function-decorator.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

// ============================================================================
// Types
// ============================================================================

interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  distance?: number;
  elapsed_time: number;
  total_elevation_gain?: number;
  average_speed?: number;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
}

interface FormattedActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  date: string;
  distance: string;
  duration: string;
  elevation_gain: string;
  average_speed: string;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
}

// ============================================================================
// Token Management
// ============================================================================

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

// Ailumina's own credential storage - independent from MCP server
const AILUMINA_DATA_DIR = process.env.AILUMINA_DATA_DIR || '/app/data';
const CREDENTIALS_DIR = path.join(AILUMINA_DATA_DIR, 'credentials');
const TOKENS_PATH = path.join(CREDENTIALS_DIR, 'strava-tokens.json');

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || '124624';
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || '61f6b75ea5da0b689e247901a3b6e56c280a7ab8';

/**
 * Ensure credentials directory exists
 */
async function ensureCredentialsDir(): Promise<void> {
  try {
    await fs.mkdir(CREDENTIALS_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
}

/**
 * Read tokens from Ailumina's own credential storage
 */
async function readTokens(): Promise<StravaTokens> {
  try {
    const tokensData = await fs.readFile(TOKENS_PATH, 'utf-8');
    return JSON.parse(tokensData);
  } catch (error) {
    throw new Error(
      `Failed to read Strava tokens from ${TOKENS_PATH}. ` +
      `Ailumina needs its own Strava credentials. ` +
      `Please initialize: docker exec consciousness-server node -e "require('./dist/shared/tools/functions/strava-tools.js').initializeStravaCredentials()"`
    );
  }
}

/**
 * Write tokens to Ailumina's credential storage
 */
async function writeTokens(tokens: StravaTokens): Promise<void> {
  await ensureCredentialsDir();
  await fs.writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<StravaTokens> {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${error}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Get a valid access token, refreshing if necessary
 */
async function getValidAccessToken(): Promise<string> {
  const tokens = await readTokens();

  // Check if token is still valid (with 5 minute buffer)
  const bufferMs = 5 * 60 * 1000;
  if (Date.now() + bufferMs < tokens.expiresAt) {
    return tokens.accessToken;
  }

  // Token expired, refresh it
  console.log('[Strava Tools] Refreshing expired access token...');
  const newTokens = await refreshAccessToken(tokens.refreshToken);
  await writeTokens(newTokens);
  console.log('[Strava Tools] Token refreshed successfully');

  return newTokens.accessToken;
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format duration from seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
}

/**
 * Format a single activity for display
 */
function formatActivity(activity: StravaActivity): FormattedActivity {
  const distance = activity.distance ? `${(activity.distance / 1000).toFixed(2)} km` : 'N/A';
  const duration = formatDuration(activity.elapsed_time);
  const date = new Date(activity.start_date_local).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });

  return {
    id: activity.id,
    name: activity.name,
    type: activity.type,
    sport_type: activity.sport_type,
    date: date,
    distance: distance,
    duration: duration,
    elevation_gain: activity.total_elevation_gain ? `${activity.total_elevation_gain}m` : 'N/A',
    average_speed: activity.average_speed
      ? `${(activity.average_speed * 3.6).toFixed(1)} km/h`
      : 'N/A',
    trainer: activity.trainer,
    commute: activity.commute,
    manual: activity.manual,
  };
}

// ============================================================================
// Tool Functions
// ============================================================================

/**
 * List Strava activities with optional filtering and pagination
 */
export async function listStravaActivities(
  parameters: unknown = {},
  _context?: ToolContext
): Promise<string> {
  const params = parameters && typeof parameters === 'object'
    ? (parameters as { before?: number; after?: number; page?: number; per_page?: number })
    : {};

  const { before, after, page = 1, per_page = 10 } = params;
  const startTime = Date.now();

  try {
    // Step 1: Build query parameters
    const queryParams = new URLSearchParams({
      page: page.toString(),
      per_page: per_page.toString(),
    });

    if (before) queryParams.append('before', before.toString());
    if (after) queryParams.append('after', after.toString());

    console.log(`[Strava Tools] Step 1: Built query params (${Date.now() - startTime}ms)`);

    // Step 2: Get valid access token (refreshes if needed)
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken();
      console.log(`[Strava Tools] Step 2: Got valid access token (${Date.now() - startTime}ms)`);
    } catch (tokenError) {
      throw new Error(
        `Token acquisition failed: ${tokenError instanceof Error ? tokenError.message : String(tokenError)}. ` +
        `Check if ${TOKENS_PATH} exists and contains valid tokens.`
      );
    }

    // Step 3: Make API request
    const url = `${STRAVA_API_BASE}/athlete/activities?${queryParams}`;
    console.log(`[Strava Tools] Step 3: Fetching from ${url} (${Date.now() - startTime}ms)`);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      console.log(`[Strava Tools] Step 3: Received response ${response.status} (${Date.now() - startTime}ms)`);
    } catch (fetchError) {
      throw new Error(
        `Network request failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}. ` +
        `Check internet connectivity and Strava API availability.`
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Strava API returned error ${response.status}: ${errorText}. ` +
        `This may indicate invalid token, rate limiting, or API issues.`
      );
    }

    // Step 4: Parse response
    let activities: StravaActivity[];
    try {
      activities = await response.json() as StravaActivity[];
      console.log(`[Strava Tools] Step 4: Parsed ${activities.length} activities (${Date.now() - startTime}ms)`);
    } catch (parseError) {
      throw new Error(
        `Failed to parse API response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );
    }

    // Step 5: Format activities for display
    const formattedActivities = activities.map(formatActivity);
    const totalTime = Date.now() - startTime;
    console.log(`[Strava Tools] Step 5: Formatted activities, total time: ${totalTime}ms`);

    return JSON.stringify({
      success: true,
      count: formattedActivities.length,
      activities: formattedActivities,
      performance: {
        total_time_ms: totalTime,
        api_endpoint: url,
      },
    }, null, 2);

  } catch (error: unknown) {
    const totalTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[Strava Tools] ERROR after ${totalTime}ms:`, errorMessage);

    return JSON.stringify({
      success: false,
      error: 'Failed to fetch Strava activities',
      message: errorMessage,
      details: {
        tokens_path: TOKENS_PATH,
        api_base: STRAVA_API_BASE,
        elapsed_time_ms: totalTime,
        parameters: { before, after, page, per_page },
      },
      troubleshooting: [
        'Check if tokens.json exists at ' + TOKENS_PATH,
        'Verify STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET env vars are set',
        'Check network connectivity to api.strava.com',
        'Verify tokens are not expired (run OAuth flow if needed)',
        'Check Docker container can reach external APIs',
      ],
    }, null, 2);
  }
}

/**
 * Create a new manual activity on Strava
 */
export async function createStravaActivity(
  parameters: unknown = {},
  _context?: ToolContext
): Promise<string> {
  const params = parameters && typeof parameters === 'object'
    ? (parameters as {
        name?: string;
        type?: string;
        start_date_local?: string;
        elapsed_time?: number;
        sport_type?: string;
        description?: string;
        distance?: number;
        trainer?: boolean;
        commute?: boolean;
      })
    : {};

  const {
    name,
    type,
    start_date_local,
    elapsed_time,
    sport_type,
    description,
    distance,
    trainer,
    commute,
  } = params;

  // Validate required parameters
  if (!name || !type || !start_date_local || !elapsed_time) {
    return JSON.stringify({
      success: false,
      error: 'Missing required parameters',
      required: ['name', 'type', 'start_date_local', 'elapsed_time'],
      provided: { name, type, start_date_local, elapsed_time },
    }, null, 2);
  }

  const startTime = Date.now();

  try {
    // Step 1: Build request body
    const body: Record<string, unknown> = {
      name,
      type,
      start_date_local,
      elapsed_time,
    };

    if (sport_type) body.sport_type = sport_type;
    if (description) body.description = description;
    if (distance !== undefined) body.distance = distance;
    if (trainer !== undefined) body.trainer = trainer ? 1 : 0;
    if (commute !== undefined) body.commute = commute ? 1 : 0;

    console.log(`[Strava Tools] Step 1: Built request body (${Date.now() - startTime}ms)`);

    // Step 2: Get valid access token
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken();
      console.log(`[Strava Tools] Step 2: Got valid access token (${Date.now() - startTime}ms)`);
    } catch (tokenError) {
      throw new Error(
        `Token acquisition failed: ${tokenError instanceof Error ? tokenError.message : String(tokenError)}. ` +
        `Check if ${TOKENS_PATH} exists and contains valid tokens.`
      );
    }

    // Step 3: Make API request
    const url = `${STRAVA_API_BASE}/activities`;
    console.log(`[Strava Tools] Step 3: Creating activity at ${url} (${Date.now() - startTime}ms)`);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      console.log(`[Strava Tools] Step 3: Received response ${response.status} (${Date.now() - startTime}ms)`);
    } catch (fetchError) {
      throw new Error(
        `Network request failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}. ` +
        `Check internet connectivity and Strava API availability.`
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Strava API returned error ${response.status}: ${errorText}. ` +
        `This may indicate invalid parameters, token issues, or API restrictions.`
      );
    }

    // Step 4: Parse response
    let activity: StravaActivity;
    try {
      activity = await response.json() as StravaActivity;
      console.log(`[Strava Tools] Step 4: Activity created successfully (${Date.now() - startTime}ms)`);
    } catch (parseError) {
      throw new Error(
        `Failed to parse API response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );
    }

    // Return formatted activity
    const totalTime = Date.now() - startTime;
    return JSON.stringify({
      success: true,
      activity: formatActivity(activity),
      message: `Created activity: ${activity.name}`,
      performance: {
        total_time_ms: totalTime,
      },
    }, null, 2);

  } catch (error: unknown) {
    const totalTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[Strava Tools] ERROR after ${totalTime}ms:`, errorMessage);

    return JSON.stringify({
      success: false,
      error: 'Failed to create Strava activity',
      message: errorMessage,
      details: {
        tokens_path: TOKENS_PATH,
        api_base: STRAVA_API_BASE,
        elapsed_time_ms: totalTime,
        provided_parameters: { name, type, start_date_local, elapsed_time, sport_type, description, distance, trainer, commute },
      },
      troubleshooting: [
        'Check if tokens.json exists at ' + TOKENS_PATH,
        'Verify activity parameters are valid (especially date format)',
        'Check network connectivity to api.strava.com',
        'Verify tokens are not expired (run OAuth flow if needed)',
        'Check Docker container can reach external APIs',
      ],
    }, null, 2);
  }
}

// ============================================================================
// Credential Initialization (for admin/setup use)
// ============================================================================

/**
 * Initialize Strava credentials for Ailumina
 * This can be called manually or via environment variables
 *
 * @param tokens - Optional tokens to write. If not provided, reads from env vars
 */
export async function initializeStravaCredentials(tokens?: StravaTokens): Promise<string> {
  try {
    await ensureCredentialsDir();

    if (tokens) {
      // Write provided tokens
      await writeTokens(tokens);
      return JSON.stringify({
        success: true,
        message: 'Strava credentials initialized successfully',
        tokens_path: TOKENS_PATH,
      }, null, 2);
    }

    // Try to read from environment variables
    const envAccessToken = process.env.STRAVA_ACCESS_TOKEN;
    const envRefreshToken = process.env.STRAVA_REFRESH_TOKEN;
    const envExpiresAt = process.env.STRAVA_EXPIRES_AT;

    if (envAccessToken && envRefreshToken && envExpiresAt) {
      const envTokens: StravaTokens = {
        accessToken: envAccessToken,
        refreshToken: envRefreshToken,
        expiresAt: parseInt(envExpiresAt, 10),
      };
      await writeTokens(envTokens);
      return JSON.stringify({
        success: true,
        message: 'Strava credentials initialized from environment variables',
        tokens_path: TOKENS_PATH,
      }, null, 2);
    }

    // No tokens provided and no env vars - return guidance
    return JSON.stringify({
      success: false,
      message: 'No credentials provided',
      instructions: [
        'Option 1: Call this function with tokens parameter',
        'Option 2: Set environment variables STRAVA_ACCESS_TOKEN, STRAVA_REFRESH_TOKEN, STRAVA_EXPIRES_AT',
        'Option 3: Manually create file at ' + TOKENS_PATH + ' with format: {"accessToken": "...", "refreshToken": "...", "expiresAt": 1234567890000}',
      ],
    }, null, 2);

  } catch (error: unknown) {
    return JSON.stringify({
      success: false,
      error: 'Failed to initialize Strava credentials',
      message: error instanceof Error ? error.message : String(error),
    }, null, 2);
  }
}

// ============================================================================
// Tool Registration
// ============================================================================

toolFunction(
  'list_strava_activities',
  'List Strava activities with optional filtering and pagination. Returns formatted activity data including name, type, distance, duration, and elevation.',
  {
    type: 'object',
    properties: {
      before: {
        type: 'number',
        description: 'Unix timestamp - return activities before this date (optional)',
      },
      after: {
        type: 'number',
        description: 'Unix timestamp - return activities after this date (optional)',
      },
      page: {
        type: 'number',
        description: 'Page number for pagination (default: 1)',
      },
      per_page: {
        type: 'number',
        description: 'Activities per page, 1-200 (default: 10)',
      },
    },
  },
  true
)(listStravaActivities);

toolFunction(
  'create_strava_activity',
  'Create a new manual activity on Strava. Requires name, type, start date, and duration. Optionally include distance, description, and flags.',
  {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Activity name (required)',
      },
      type: {
        type: 'string',
        description: 'Activity type: Run, Ride, Walk, Workout, etc. (required)',
      },
      start_date_local: {
        type: 'string',
        description: 'Start date and time in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ (required)',
      },
      elapsed_time: {
        type: 'number',
        description: 'Total elapsed time in seconds (required)',
      },
      sport_type: {
        type: 'string',
        description: 'More specific sport type (optional, defaults to type)',
      },
      description: {
        type: 'string',
        description: 'Activity description (optional)',
      },
      distance: {
        type: 'number',
        description: 'Distance in meters (optional)',
      },
      trainer: {
        type: 'boolean',
        description: 'Was this an indoor/trainer activity? (optional)',
      },
      commute: {
        type: 'boolean',
        description: 'Was this a commute? (optional)',
      },
    },
    required: ['name', 'type', 'start_date_local', 'elapsed_time'],
  },
  true
)(createStravaActivity);
