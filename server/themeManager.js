/**
 * Theme Manager
 * 
 * Handles global typography and theme settings for the site.
 * These settings define default fonts, colors, and spacing for elements.
 */

const fs = require('fs').promises;
const path = require('path');

const THEME_FILE = path.join(__dirname, '../content/theme.json');

// Default theme settings
const DEFAULT_THEME = {
  typography: {
    // Font families
    headingFont: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    bodyFont: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    
    // Element-specific settings
    h1: {
      fontFamily: 'inherit', // Uses headingFont
      fontSize: '3rem',
      fontWeight: '700',
      lineHeight: '1.2',
      letterSpacing: '-0.02em',
      marginBottom: '1rem'
    },
    h2: {
      fontFamily: 'inherit',
      fontSize: '2.25rem',
      fontWeight: '600',
      lineHeight: '1.3',
      letterSpacing: '-0.01em',
      marginBottom: '0.875rem'
    },
    h3: {
      fontFamily: 'inherit',
      fontSize: '1.875rem',
      fontWeight: '600',
      lineHeight: '1.4',
      letterSpacing: '0',
      marginBottom: '0.75rem'
    },
    h4: {
      fontFamily: 'inherit',
      fontSize: '1.5rem',
      fontWeight: '500',
      lineHeight: '1.4',
      letterSpacing: '0',
      marginBottom: '0.5rem'
    },
    h5: {
      fontFamily: 'inherit',
      fontSize: '1.25rem',
      fontWeight: '500',
      lineHeight: '1.5',
      letterSpacing: '0',
      marginBottom: '0.5rem'
    },
    h6: {
      fontFamily: 'inherit',
      fontSize: '1rem',
      fontWeight: '500',
      lineHeight: '1.5',
      letterSpacing: '0',
      marginBottom: '0.5rem'
    },
    p: {
      fontFamily: 'inherit', // Uses bodyFont
      fontSize: '1rem',
      fontWeight: '400',
      lineHeight: '1.6',
      letterSpacing: '0',
      marginBottom: '1rem'
    },
    a: {
      color: '#3b82f6',
      textDecoration: 'underline',
      hoverColor: '#2563eb'
    },
    small: {
      fontSize: '0.875rem',
      lineHeight: '1.5'
    }
  },
  
  colors: {
    // Primary brand colors
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    secondary: '#6b7280',
    secondaryHover: '#4b5563',
    
    // Text colors
    textPrimary: '#111827',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    
    // Background colors
    background: '#ffffff',
    backgroundAlt: '#f9fafb',
    backgroundDark: '#111827',
    
    // UI colors
    border: '#e5e7eb',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  },
  
  spacing: {
    // Base spacing unit (in rem)
    unit: 0.25,
    
    // Named spacing values
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem'
  },
  
  // Google Fonts to load
  googleFonts: []
};

/**
 * Load the theme from file, or return defaults
 */
async function loadTheme() {
  try {
    const data = await fs.readFile(THEME_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return defaults
    if (error.code === 'ENOENT') {
      return DEFAULT_THEME;
    }
    throw error;
  }
}

/**
 * Save the theme to file
 */
async function saveTheme(theme) {
  await fs.writeFile(THEME_FILE, JSON.stringify(theme, null, 2));
  return theme;
}

/**
 * Get the full theme
 */
async function getTheme() {
  return await loadTheme();
}

/**
 * Update the entire theme
 */
async function updateTheme(newTheme) {
  // Merge with defaults to ensure all properties exist
  const merged = deepMerge(DEFAULT_THEME, newTheme);
  return await saveTheme(merged);
}

/**
 * Get typography settings
 */
async function getTypography() {
  const theme = await loadTheme();
  return theme.typography;
}

/**
 * Update typography for a specific element
 */
async function updateTypography(element, settings) {
  const theme = await loadTheme();
  
  if (element === 'headingFont' || element === 'bodyFont') {
    // Update font family
    theme.typography[element] = settings;
  } else if (theme.typography[element]) {
    // Update element-specific settings
    theme.typography[element] = {
      ...theme.typography[element],
      ...settings
    };
  } else {
    throw new Error(`Unknown typography element: ${element}`);
  }
  
  return await saveTheme(theme);
}

/**
 * Get color palette
 */
async function getColors() {
  const theme = await loadTheme();
  return theme.colors;
}

/**
 * Update colors
 */
async function updateColors(colors) {
  const theme = await loadTheme();
  theme.colors = { ...theme.colors, ...colors };
  return await saveTheme(theme);
}

/**
 * Get spacing settings
 */
async function getSpacing() {
  const theme = await loadTheme();
  return theme.spacing;
}

/**
 * Add a Google Font to load
 */
async function addGoogleFont(fontName) {
  const theme = await loadTheme();
  if (!theme.googleFonts.includes(fontName)) {
    theme.googleFonts.push(fontName);
    await saveTheme(theme);
  }
  return theme;
}

/**
 * Remove a Google Font
 */
async function removeGoogleFont(fontName) {
  const theme = await loadTheme();
  theme.googleFonts = theme.googleFonts.filter(f => f !== fontName);
  return await saveTheme(theme);
}

/**
 * Generate CSS from theme settings
 * This creates a CSS string that can be injected into the page
 */
async function generateCSS() {
  const theme = await loadTheme();
  const { typography, colors, spacing } = theme;
  
  let css = `
/* NodeLx Theme - Auto Generated */
:root {
  /* Typography */
  --heading-font: ${typography.headingFont};
  --body-font: ${typography.bodyFont};
  
  /* Colors */
  --color-primary: ${colors.primary};
  --color-primary-hover: ${colors.primaryHover};
  --color-secondary: ${colors.secondary};
  --color-secondary-hover: ${colors.secondaryHover};
  --color-text-primary: ${colors.textPrimary};
  --color-text-secondary: ${colors.textSecondary};
  --color-text-muted: ${colors.textMuted};
  --color-background: ${colors.background};
  --color-background-alt: ${colors.backgroundAlt};
  --color-background-dark: ${colors.backgroundDark};
  --color-border: ${colors.border};
  --color-success: ${colors.success};
  --color-warning: ${colors.warning};
  --color-error: ${colors.error};
  
  /* Spacing */
  --spacing-xs: ${spacing.xs};
  --spacing-sm: ${spacing.sm};
  --spacing-md: ${spacing.md};
  --spacing-lg: ${spacing.lg};
  --spacing-xl: ${spacing.xl};
  --spacing-2xl: ${spacing['2xl']};
  --spacing-3xl: ${spacing['3xl']};
}

body {
  font-family: var(--body-font);
  color: var(--color-text-primary);
  background-color: var(--color-background);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--heading-font);
}

h1 {
  font-size: ${typography.h1.fontSize};
  font-weight: ${typography.h1.fontWeight};
  line-height: ${typography.h1.lineHeight};
  letter-spacing: ${typography.h1.letterSpacing};
  margin-bottom: ${typography.h1.marginBottom};
}

h2 {
  font-size: ${typography.h2.fontSize};
  font-weight: ${typography.h2.fontWeight};
  line-height: ${typography.h2.lineHeight};
  letter-spacing: ${typography.h2.letterSpacing};
  margin-bottom: ${typography.h2.marginBottom};
}

h3 {
  font-size: ${typography.h3.fontSize};
  font-weight: ${typography.h3.fontWeight};
  line-height: ${typography.h3.lineHeight};
  letter-spacing: ${typography.h3.letterSpacing};
  margin-bottom: ${typography.h3.marginBottom};
}

h4 {
  font-size: ${typography.h4.fontSize};
  font-weight: ${typography.h4.fontWeight};
  line-height: ${typography.h4.lineHeight};
  letter-spacing: ${typography.h4.letterSpacing};
  margin-bottom: ${typography.h4.marginBottom};
}

h5 {
  font-size: ${typography.h5.fontSize};
  font-weight: ${typography.h5.fontWeight};
  line-height: ${typography.h5.lineHeight};
  letter-spacing: ${typography.h5.letterSpacing};
  margin-bottom: ${typography.h5.marginBottom};
}

h6 {
  font-size: ${typography.h6.fontSize};
  font-weight: ${typography.h6.fontWeight};
  line-height: ${typography.h6.lineHeight};
  letter-spacing: ${typography.h6.letterSpacing};
  margin-bottom: ${typography.h6.marginBottom};
}

p {
  font-size: ${typography.p.fontSize};
  font-weight: ${typography.p.fontWeight};
  line-height: ${typography.p.lineHeight};
  letter-spacing: ${typography.p.letterSpacing};
  margin-bottom: ${typography.p.marginBottom};
}

a {
  color: ${typography.a.color};
  text-decoration: ${typography.a.textDecoration};
}

a:hover {
  color: ${typography.a.hoverColor};
}

small {
  font-size: ${typography.small.fontSize};
  line-height: ${typography.small.lineHeight};
}
`;

  return css.trim();
}

/**
 * Generate Google Fonts link tags
 */
async function generateGoogleFontsLink() {
  const theme = await loadTheme();
  
  if (theme.googleFonts.length === 0) {
    return '';
  }
  
  const families = theme.googleFonts
    .map(font => font.replace(/ /g, '+'))
    .join('&family=');
  
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${families}&display=swap" rel="stylesheet">`;
}

/**
 * Reset theme to defaults
 */
async function resetTheme() {
  return await saveTheme(DEFAULT_THEME);
}

/**
 * Deep merge utility
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

// Popular Google Fonts for suggestions
const POPULAR_FONTS = {
  headings: [
    'Playfair Display',
    'Merriweather',
    'Lora',
    'Roboto Slab',
    'Montserrat',
    'Oswald',
    'Poppins',
    'Raleway',
    'DM Serif Display',
    'Libre Baskerville'
  ],
  body: [
    'Inter',
    'Roboto',
    'Open Sans',
    'Lato',
    'Source Sans Pro',
    'Nunito',
    'Work Sans',
    'DM Sans',
    'IBM Plex Sans',
    'Karla'
  ]
};

module.exports = {
  getTheme,
  updateTheme,
  getTypography,
  updateTypography,
  getColors,
  updateColors,
  getSpacing,
  addGoogleFont,
  removeGoogleFont,
  generateCSS,
  generateGoogleFontsLink,
  resetTheme,
  DEFAULT_THEME,
  POPULAR_FONTS
};
