import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { ChatBubbleOutlined } from "@mui/icons-material";
import { confirmChatLink } from "@/features/chat/api/chatLinkApi";
import { ApiError } from "@/lib/api/apiError";
import { ROUTES } from "@/routes/paths";
import { en } from "@/i18n/en";

const c = en.linkChat;

type Phase = "prompt" | "linking" | "success" | "expired" | "used" | "invalid" | "error";

/** Web confirm step of the chat-account linking flow (PR 077). Reads the one-time
 * `?code=` shown in the user's chat DM and binds it to their logged-in account. */
export function LinkChatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");

  const [phase, setPhase] = useState<Phase>(code ? "prompt" : "invalid");
  const [email, setEmail] = useState<string>("");

  async function handleConfirm() {
    if (!code) {
      setPhase("invalid");
      return;
    }
    setPhase("linking");
    try {
      const res = await confirmChatLink(code);
      setEmail(res.linked_email);
      setPhase("success");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const data = err.data as { code?: string } | undefined;
        if (data?.code === "expired") return setPhase("expired");
        if (data?.code === "used") return setPhase("used");
        if (data?.code === "invalid") return setPhase("invalid");
      }
      setPhase("error");
    }
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: { xs: 4, sm: 8 }, px: 2 }}>
      <Card variant="outlined" sx={{ maxWidth: 460, width: "100%" }}>
        <CardContent>
          <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
            <ChatBubbleOutlined sx={{ fontSize: 40, color: "primary.main" }} />
            <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>
              {c.title}
            </Typography>

            {phase === "prompt" && (
              <>
                <Typography variant="body2" color="text.secondary">
                  {c.prompt}
                </Typography>
                <Stack direction="row" spacing={1.5}>
                  <Button variant="outlined" onClick={() => navigate(ROUTES.app)}>
                    {c.cancel}
                  </Button>
                  <Button variant="contained" onClick={handleConfirm} data-testid="link-confirm">
                    {c.confirm}
                  </Button>
                </Stack>
              </>
            )}

            {phase === "linking" && (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <CircularProgress size={20} />
                <Typography variant="body2">{c.linking}</Typography>
              </Stack>
            )}

            {phase === "success" && (
              <>
                <Alert severity="success" sx={{ width: "100%" }} data-testid="link-success">
                  <Typography sx={{ fontWeight: 600 }}>{c.successTitle}</Typography>
                  {c.successBody.replace("{email}", email)}
                </Alert>
                <Button variant="contained" onClick={() => navigate(ROUTES.app)}>
                  {c.done}
                </Button>
              </>
            )}

            {(phase === "expired" ||
              phase === "used" ||
              phase === "invalid" ||
              phase === "error") && (
              <Alert
                severity={phase === "error" ? "error" : "warning"}
                sx={{ width: "100%" }}
                data-testid={`link-${phase}`}
              >
                <Typography sx={{ fontWeight: 600 }}>
                  {phase === "expired"
                    ? c.expiredTitle
                    : phase === "used"
                      ? c.usedTitle
                      : phase === "invalid"
                        ? c.invalidTitle
                        : c.errorTitle}
                </Typography>
                {phase === "expired"
                  ? c.expiredBody
                  : phase === "used"
                    ? c.usedBody
                    : phase === "invalid"
                      ? code
                        ? c.invalidBody
                        : c.missingCode
                      : c.errorBody}
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
