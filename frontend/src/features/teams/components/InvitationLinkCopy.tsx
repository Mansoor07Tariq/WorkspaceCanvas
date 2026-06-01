import { useState } from "react";
import { Box, Button, InputAdornment, TextField, Tooltip } from "@mui/material";
import { CheckOutlined, ContentCopyOutlined, LinkOutlined } from "@mui/icons-material";

interface Props {
  token: string;
}

export function InvitationLinkCopy({ token }: Props) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/invite/${token}`;

  function handleCopy() {
    void navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.5 }}>
      <TextField
        value={link}
        size="small"
        slotProps={{
          input: {
            readOnly: true,
            startAdornment: (
              <InputAdornment position="start">
                <LinkOutlined fontSize="small" color="action" />
              </InputAdornment>
            ),
            sx: { fontSize: "0.75rem", fontFamily: "monospace" },
          },
        }}
        sx={{ flex: 1, "& .MuiInputBase-input": { cursor: "text" } }}
        aria-label={`Invite link for token ${token}`}
      />
      <Tooltip title={copied ? "Copied!" : "Copy link"}>
        <Button
          size="small"
          variant="outlined"
          onClick={handleCopy}
          startIcon={
            copied ? <CheckOutlined fontSize="small" /> : <ContentCopyOutlined fontSize="small" />
          }
          aria-label="Copy invite link"
          color={copied ? "success" : "primary"}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </Tooltip>
    </Box>
  );
}
