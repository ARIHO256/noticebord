import { api } from '../api/client';
import * as FileSystem from 'expo-file-system';

export type ModerationResult = {
  isSafe: boolean;
  reason?: string;
  confidence?: number;
  categories?: string[];
};

export type ModerationError = {
  message: string;
  code: string;
};

/**
 * Profanity and inappropriate words list - ONLY truly immoral/explicit words
 * Focus on words that are clearly inappropriate in ALL contexts (like TikTok bans)
 */
const PROFANITY_WORDS = [
  // Most explicit profanity only
  'fuck', 'fucking', 'fucked', 'fucker', 'fucks',
  'shit', 'shitting', 'shitted', 'shits',
  'bitch', 'bitches',
  'asshole', 'assholes',
  // Explicit sexual content (only when clearly inappropriate)
  'porn', 'pornography',
];

// Threatening phrases and sentences - focus on clear, direct threats
// Only phrases that are clearly threatening in most contexts
const THREATENING_PHRASES = [
  // Self-harm threats
  'kill yourself',
  'kys',
  'go kill yourself',
  // Direct threats to others
  'i will kill you',
  'i\'ll kill you',
  'i will hurt you',
  'i\'ll hurt you',
  'i will harm you',
  'i\'ll harm you',
  'i will beat you',
  'i\'ll beat you',
  'i will attack you',
  'i\'ll attack you',
  // Death threats (more specific)
  'you should die',
  'i hope you die',
  'i wish you were dead',
  'go die',
  // Violence threats
  'i will stab you',
  'i\'ll stab you',
  'i will shoot you',
  'i\'ll shoot you',
  'i will punch you',
  'i\'ll punch you',
];

// Sexual harassment phrases - unwanted sexual advances and comments
// Focus on clear harassment patterns, not general compliments
const SEXUAL_HARASSMENT_PHRASES = [
  // Explicit requests for sexual content
  'send me nudes',
  'send nudes',
  'show me your body',
  'show me your boobs',
  'show me your tits',
  'show me your ass',
  'show me your pussy',
  'show me your dick',
  'let me see your body',
  'let me see your boobs',
  'let me see your tits',
  'let me see your ass',
  'i want to see your body',
  'i want to see your boobs',
  'i want to see your tits',
  'i want to see your ass',
  // Explicit requests to undress
  'take off your clothes',
  'take your clothes off',
  'get naked',
  'strip for me',
  // Sexual propositions
  'be my sugar daddy',
  'be my sugar mommy',
  'sugar daddy',
  'sugar mommy',
  'want to hook up',
  'let\'s hook up',
  'come to my place',
  'come over to my place',
  'sleep with me',
  'have sex with me',
  'want to have sex',
  'let\'s have sex',
  'i want to have sex',
  'i want you sexually',
  'i need you sexually',
  // Explicit sexual comments (more specific)
  'nice ass',
  'nice tits',
  'nice boobs',
  'nice pussy',
  'nice dick',
];

// Hate speech and racism - slurs and derogatory terms
const HATE_SPEECH_WORDS = [
  // Racial slurs (common ones - be careful with false positives)
  'nigger', 'nigga', 'nigg',
  'chink',
  'spic',
  'kike',
  'gook',
  'towelhead',
  'sand nigger',
  'taco',
  'wetback',
  // Other derogatory terms
  'retard', 'retarded',
  'faggot', 'fag',
  'tranny',
  'dyke',
];

// Hate speech phrases - racist and discriminatory statements
// Focus on clearly discriminatory phrases
const HATE_SPEECH_PHRASES = [
  // Racist phrases
  'all [group] are',
  'you people are',
  'your kind',
  'go back to your country',
  'go back to where you came from',
  'you don\'t belong here',
  'you\'re not welcome here',
  'we don\'t want you here',
  'you\'re inferior',
  'you\'re subhuman',
  'you\'re less than human',
  'white power',
  'black power',
  'kill all [group]',
  'exterminate [group]',
  'ethnic cleansing',
  'racial purity',
  'you\'re a dirty [group]',
  'you\'re a stupid [group]',
  'you\'re an inferior [group]',
  'all [group] should die',
  'all [group] are criminals',
  'all [group] are terrorists',
];

/**
 * Check if text contains inappropriate content
 */
export const moderateText = async (text: string): Promise<ModerationResult> => {
  if (!text || !text.trim()) {
    return { isSafe: true };
  }

  const trimmedText = text.trim();
  const lowerText = trimmedText.toLowerCase();
  
  // Check for profanity - use word boundaries to avoid false positives
  // Only check for the most explicit words
  const foundProfanity = PROFANITY_WORDS.some(word => {
    // Use word boundaries to match whole words only (prevents false matches)
    // Escape special regex characters in the word
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escapedWord}\\b`, 'i');
    const matches = pattern.test(trimmedText);
    return matches;
  });

  // Check for threatening phrases (exact phrase matching)
  const foundThreats = THREATENING_PHRASES.some(phrase => {
    return lowerText.includes(phrase.toLowerCase());
  });

  // Check for sexual harassment phrases
  const foundHarassment = SEXUAL_HARASSMENT_PHRASES.some(phrase => {
    return lowerText.includes(phrase.toLowerCase());
  });

  // Check for hate speech words (use word boundaries)
  const foundHateWords = HATE_SPEECH_WORDS.some(word => {
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escapedWord}\\b`, 'i');
    return pattern.test(trimmedText);
  });

  // Check for hate speech phrases
  const foundHatePhrases = HATE_SPEECH_PHRASES.some(phrase => {
    const phraseLower = phrase.toLowerCase();
    // For phrases with placeholders like [group], check if pattern matches
    if (phrase.includes('[group]')) {
      const pattern = phraseLower.replace('[group]', '\\w+');
      const regex = new RegExp(pattern, 'i');
      return regex.test(trimmedText);
    }
    return lowerText.includes(phraseLower);
  });

  // Only block if we find explicit profanity, threats, harassment, or hate speech
  if (foundProfanity || foundThreats || foundHarassment || foundHateWords || foundHatePhrases) {
    const categories = [];
    if (foundProfanity) categories.push('profanity');
    if (foundThreats) categories.push('threatening');
    if (foundHarassment) categories.push('sexual_harassment');
    if (foundHateWords || foundHatePhrases) categories.push('hate_speech');
    
    let reason = 'Content violates community guidelines';
    if (foundHarassment) {
      reason = 'Content contains sexual harassment';
    } else if (foundHateWords || foundHatePhrases) {
      reason = 'Content contains hate speech or racism';
    } else if (foundThreats) {
      reason = 'Content contains threatening language';
    } else if (foundProfanity) {
      reason = 'Content contains inappropriate language';
    }
    
    return {
      isSafe: false,
      reason,
      confidence: 0.95,
      categories: categories.length > 0 ? categories : ['inappropriate_language'],
    };
  }

  // Check for excessive caps (spam indicator) - more lenient
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.8 && text.length > 30) {
    // Spam detection is less strict - just a warning, not a violation
    // Return safe but with lower confidence
    return {
      isSafe: true,  // Changed to true - spam is not a violation
      reason: undefined,
      confidence: 0.6,
      categories: ['spam'],
    };
  }

  // Check for repeated characters (spam indicator) - more lenient
  const repeatedChars = /(.)\1{6,}/.test(text);  // Require 6+ repeated chars
  if (repeatedChars) {
    // Spam detection is less strict
    return {
      isSafe: true,  // Changed to true - spam is not a violation
      reason: undefined,
      confidence: 0.5,
      categories: ['spam'],
    };
  }

  // If all checks pass, send to backend for additional analysis
  try {
    const response = await api.post<ModerationResult>('/moderation/check-text/', {
      text,
    });
    const backendResult = response.data;
    // Only block if backend explicitly says it's unsafe AND it's profanity.
    if (!backendResult.isSafe && backendResult.categories?.includes('profanity')) {
      return backendResult;
    }
    // If backend says unsafe but it's not profanity (e.g. spam), allow it.
    if (!backendResult.isSafe) {
      return { ...backendResult, isSafe: true, reason: undefined };
    }
    return backendResult;
  } catch (error: any) {
    // If backend check fails, allow the content (fail open)
    // This prevents blocking legitimate comments when the moderation service has issues
    console.warn('Backend moderation check failed, allowing content:', error);
    return { isSafe: true };
  }
};

/**
 * Moderate an image file
 */
export const moderateImage = async (imageUri: string): Promise<ModerationResult> => {
  try {
    // Read image as base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Send to backend for analysis
    const response = await api.post<ModerationResult>('/moderation/check-image/', {
      image: base64,
      mime_type: 'image/jpeg', // Can be determined from file
    });

    return response.data;
  } catch (error: any) {
    console.error('Image moderation error:', error);
    
    // If backend check fails, allow the content (fail open)
    // This prevents blocking legitimate uploads when the moderation service has issues
    
    // If moderation fails due to network/backend issues, allow the upload (fail open)
    // This prevents blocking legitimate uploads when the moderation service is down
    // In production with a reliable moderation API, you might want to fail closed
    console.warn('Image moderation check failed, allowing upload:', error?.response?.data?.detail || error?.message);
    return {
      isSafe: true,
      reason: undefined,
      confidence: 0.5,
      categories: [],
    };
  }
};

/**
 * Moderate a video file
 */
export const moderateVideo = async (videoUri: string): Promise<ModerationResult> => {
  try {
    // For videos, we'll extract a thumbnail and analyze it
    // In a full implementation, you might want to analyze multiple frames
    // For now, we'll send the video metadata to backend
    
    const fileInfo = await FileSystem.getInfoAsync(videoUri);
    if (!fileInfo.exists) {
      return {
        isSafe: false,
        reason: 'Video file not found',
        confidence: 1.0,
        categories: ['file_error'],
      };
    }

    // Send video info to backend for analysis
    // Backend can extract frames and analyze them
    const response = await api.post<ModerationResult>('/moderation/check-video/', {
      video_uri: videoUri,
      // In production, you might want to upload the video or send key frames
    });

    return response.data;
  } catch (error: any) {
    console.error('Video moderation error:', error);
    
    // Fail closed for safety
    return {
      isSafe: false,
      reason: error?.response?.data?.detail || 'Unable to verify video content',
      confidence: 0.5,
      categories: ['moderation_error'],
    };
  }
};

/**
 * Moderate multiple content types at once
 */
export const moderateContent = async (options: {
  text?: string;
  images?: string[];
  videos?: string[];
}): Promise<{
  isSafe: boolean;
  results: {
    text?: ModerationResult;
    images?: ModerationResult[];
    videos?: ModerationResult[];
  };
  reason?: string;
}> => {
  const results: {
    text?: ModerationResult;
    images?: ModerationResult[];
    videos?: ModerationResult[];
  } = {};

  // Moderate text
  if (options.text) {
    results.text = await moderateText(options.text);
  }

  // Moderate images
  if (options.images && options.images.length > 0) {
    results.images = await Promise.all(
      options.images.map(uri => moderateImage(uri))
    );
  }

  // Moderate videos
  if (options.videos && options.videos.length > 0) {
    results.videos = await Promise.all(
      options.videos.map(uri => moderateVideo(uri))
    );
  }

  // Determine overall safety
  const allResults = [
    results.text,
    ...(results.images || []),
    ...(results.videos || []),
  ].filter(Boolean) as ModerationResult[];

  const unsafeResults = allResults.filter(r => !r.isSafe);
  const isSafe = unsafeResults.length === 0;

  let reason: string | undefined;
  if (!isSafe) {
    const reasons = unsafeResults
      .map(r => r.reason)
      .filter(Boolean) as string[];
    reason = reasons.join('; ') || 'Content violates community guidelines';
  }

  return {
    isSafe,
    results,
    reason,
  };
};
