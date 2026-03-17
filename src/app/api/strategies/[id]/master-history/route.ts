// Re-export handler to avoid wrapper/TDZ issues in bundling.
export { GET, dynamic, revalidate, maxDuration } from './handler';
