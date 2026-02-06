/**
 * CSV Parser - Platform-specific CSV parsing with column alias support
 */

/**
 * Parse CSV content for a specific platform
 * @param {string} csvContent - Raw CSV content
 * @param {string} platform - Platform name (youtube, tiktok, instagram)
 * @returns {Array<Object>} Parsed rows with normalized column names
 */
function parseCSV(csvContent, platform) {
  // Parse raw CSV
  const rows = Utilities.parseCsv(csvContent);

  if (rows.length < 2) {
    throw new Error('CSV has no data rows');
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Get column aliases for this platform
  const aliases = CONFIG.COLUMN_ALIASES[platform];
  if (!aliases) {
    throw new Error(`Unknown platform: ${platform}`);
  }

  // Map headers to normalized names
  const headerMap = mapHeaders(headers, aliases);

  // Parse each row
  const parsed = dataRows.map((row, rowIndex) => {
    const record = {
      _raw_row: row.join(','),
      _row_index: rowIndex + 2,  // 1-indexed, accounting for header
      _platform: platform,
      _import_timestamp: new Date().toISOString()
    };

    // Map each column
    Object.entries(headerMap).forEach(([normalizedName, columnIndex]) => {
      if (columnIndex !== -1 && row[columnIndex] !== undefined) {
        record[normalizedName] = parseValue(row[columnIndex], normalizedName);
      }
    });

    return record;
  });

  // Filter out empty rows
  return parsed.filter(row => hasRequiredFields(row, platform));
}

/**
 * Map CSV headers to normalized names using aliases
 */
function mapHeaders(headers, aliases) {
  const headerMap = {};

  Object.entries(aliases).forEach(([normalizedName, possibleNames]) => {
    headerMap[normalizedName] = -1;  // Default to not found

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].trim();
      if (possibleNames.some(alias =>
        header.toLowerCase() === alias.toLowerCase() ||
        header.toLowerCase().includes(alias.toLowerCase())
      )) {
        headerMap[normalizedName] = i;
        break;
      }
    }
  });

  return headerMap;
}

/**
 * Parse and convert value based on expected type
 */
function parseValue(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const stringValue = String(value).trim();

  // Numeric fields
  const numericFields = [
    'views', 'watch_time_hours', 'avg_view_duration', 'avg_watch_time',
    'ctr', 'likes', 'comments', 'shares', 'saves',
    'subscribers_gained', 'completion_rate', 'engagement_rate', 'reach'
  ];

  if (numericFields.includes(fieldName)) {
    // Remove commas and percentage signs
    const cleaned = stringValue.replace(/[,%]/g, '');
    const num = parseFloat(cleaned);

    if (isNaN(num)) {
      return null;
    }

    // Convert percentage to decimal if needed
    if (stringValue.includes('%') && num > 1) {
      return num / 100;
    }

    return num;
  }

  // Date fields
  const dateFields = ['publish_date', 'upload_date', 'posted_date'];
  if (dateFields.includes(fieldName)) {
    try {
      return new Date(stringValue).toISOString();
    } catch (e) {
      return stringValue;
    }
  }

  // Default: return as string
  return stringValue;
}

/**
 * Check if row has required fields for the platform
 */
function hasRequiredFields(row, platform) {
  const requiredByPlatform = {
    youtube: ['video_id', 'views'],
    tiktok: ['video_id', 'views'],
    instagram: ['reel_id', 'views']
  };

  const required = requiredByPlatform[platform] || [];
  return required.every(field => row[field] !== null && row[field] !== undefined);
}

/**
 * Auto-detect platform from CSV headers
 */
function detectPlatform(csvContent) {
  const firstLine = csvContent.split('\n')[0].toLowerCase();

  // YouTube-specific headers
  if (firstLine.includes('watch time') || firstLine.includes('総再生時間')) {
    return 'youtube';
  }

  // TikTok-specific headers
  if (firstLine.includes('tiktok') || firstLine.includes('video views')) {
    return 'tiktok';
  }

  // Instagram-specific headers
  if (firstLine.includes('reel') || firstLine.includes('plays')) {
    return 'instagram';
  }

  return null;
}

/**
 * Validate parsed data
 */
function validateParsedData(parsed, platform) {
  const errors = [];

  parsed.forEach((row, index) => {
    // Check for negative values in count fields
    const countFields = ['views', 'likes', 'comments', 'shares', 'saves'];
    countFields.forEach(field => {
      if (row[field] !== null && row[field] < 0) {
        errors.push(`Row ${row._row_index}: ${field} has negative value`);
      }
    });

    // Check for rate fields out of range
    const rateFields = ['ctr', 'completion_rate', 'engagement_rate'];
    rateFields.forEach(field => {
      if (row[field] !== null && (row[field] < 0 || row[field] > 1)) {
        errors.push(`Row ${row._row_index}: ${field} out of range (0-1)`);
      }
    });
  });

  return errors;
}
