import { useEffect, useReducer, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Typography,
} from "@mui/material";
import { GroupAddOutlined } from "@mui/icons-material";
import { useAuth } from "@/features/auth/context/AuthContext";
import { acceptInvitation, getInvitationByToken } from "@/features/teams/api/teamsApi";
import type { InvitationPublic } from "@/features/teams/types/teams.types";
import { ROUTES } from "@/routes/paths";

interface InfoState {
  invitation: InvitationPublic | null;
  loading: boolean;
  error: string | null;
}

type InfoAction =
  | { type: "start" }
  | { type: "success"; payload: InvitationPublic }
  | { type: "error"; payload: string };

function infoReducer(_state: InfoState, action: InfoAction): InfoState {
  switch (action.type) {
    case "start":
      return { invitation: null, loading: true, error: null };
    case "success":
      return { invitation: action.payload, loading: false, error: null };
    case "error":
      return { invitation: null, loading: false, error: action.payload };
  }
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [infoState, dispatchInfo] = useReducer(infoReducer, {
    invitation: null,
    loading: true,
    error: null,
  });

  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) return;
    dispatchInfo({ type: "start" });
    getInvitationByToken(token)
      .then((data) => dispatchInfo({ type: "success", payload: data }))
      .catch(() =>
        dispatchInfo({
          type: "error",
          payload: "This invitation link is invalid or has expired.",
        })
      );
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      await acceptInvitation(token);
      setAccepted(true);
      setTimeout(() => navigate(ROUTES.app), 1500);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Could not accept invitation. Please try again.";
      setAcceptError(msg);
    } finally {
      setAccepting(false);
    }
  }

  if (infoState.loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: "center" }}>
        <CircularProgress aria-label="Loading invitation details" />
      </Container>
    );
  }

  if (infoState.error || !infoState.invitation) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error" role="alert">
          {infoState.error ?? "Invitation not found."}
        </Alert>
        <Button variant="text" sx={{ mt: 2 }} onClick={() => navigate(ROUTES.login)}>
          Back to sign in
        </Button>
      </Container>
    );
  }

  const { invitation } = infoState;
  const isInvalidStatus =
    invitation.status === "cancelled" || invitation.status === "accepted" || invitation.is_expired;

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
      <Card variant="outlined">
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <GroupAddOutlined color="primary" fontSize="large" />
            <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>
              You've been invited
            </Typography>
          </Box>

          <Typography variant="body1" sx={{ mb: 1 }}>
            Join <strong>{invitation.organization_name}</strong> as a{" "}
            <strong>{ROLE_LABEL[invitation.role] ?? invitation.role}</strong>.
          </Typography>

          {isInvalidStatus && (
            <Alert severity="warning" role="alert" sx={{ mt: 2 }}>
              {invitation.status === "cancelled" && "This invitation has been cancelled."}
              {invitation.status === "accepted" && "This invitation has already been accepted."}
              {invitation.is_expired &&
                invitation.status === "pending" &&
                "This invitation has expired."}
            </Alert>
          )}

          {accepted && (
            <Alert severity="success" role="alert" sx={{ mt: 2 }}>
              You've joined {invitation.organization_name}! Redirecting to your dashboard…
            </Alert>
          )}

          {acceptError && (
            <Alert severity="error" role="alert" sx={{ mt: 2 }}>
              {acceptError}
            </Alert>
          )}

          {!isInvalidStatus && !accepted && (
            <Box sx={{ mt: 3 }}>
              {!user ? (
                <>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Sign in or create an account to accept this invitation.
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1.5 }}>
                    <Button
                      variant="contained"
                      onClick={() =>
                        navigate(ROUTES.login, {
                          state: { returnTo: `/invite/${token}` },
                        })
                      }
                    >
                      Sign in
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() =>
                        navigate(ROUTES.signup, {
                          state: { returnTo: `/invite/${token}` },
                        })
                      }
                    >
                      Create account
                    </Button>
                  </Box>
                </>
              ) : (
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => void handleAccept()}
                  disabled={accepting}
                  fullWidth
                >
                  {accepting ? "Joining…" : `Join ${invitation.organization_name}`}
                </Button>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
