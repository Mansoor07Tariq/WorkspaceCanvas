import { Box, CircularProgress } from "@mui/material";

/**
 * Full-viewport loading fallback used as the Suspense boundary for lazy-loaded route pages.
 * Fills the available height so layout does not jank while the chunk loads.
 */
export function PageLoading() {
  return (
    <Box
      role="status"
      aria-label="Loading page"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <CircularProgress />
    </Box>
  );
}
