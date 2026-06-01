import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import type { CreateInvitationPayload, InvitationRole } from "../types/teams.types";

interface Props {
  onSubmit: (payload: CreateInvitationPayload) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export function InviteMemberForm({ onSubmit, loading, error }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("member");
  const [emailError, setEmailError] = useState("");
  const [success, setSuccess] = useState(false);

  function validate(): boolean {
    if (!email.trim()) {
      setEmailError("Email is required.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Enter a valid email address.");
      return false;
    }
    setEmailError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    if (!validate()) return;
    const ok = await onSubmit({ email: email.trim().toLowerCase(), role });
    if (ok) {
      setEmail("");
      setRole("member");
      setSuccess(true);
    }
  }

  return (
    <Box component="form" onSubmit={(e) => void handleSubmit(e)} noValidate>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
        Invite a team member
      </Typography>

      {success && (
        <Alert severity="success" role="alert" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
          Invitation sent successfully.
        </Alert>
      )}
      {error && (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-start" }}>
        <TextField
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError("");
            if (success) setSuccess(false);
          }}
          error={!!emailError}
          helperText={emailError || " "}
          required
          size="small"
          sx={{ flex: "1 1 220px", minWidth: 200 }}
          slotProps={{ htmlInput: { "aria-label": "Email address" } }}
        />

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="role-select-label">Role</InputLabel>
          <Select
            labelId="role-select-label"
            label="Role"
            value={role}
            onChange={(e: SelectChangeEvent) => setRole(e.target.value as InvitationRole)}
          >
            <MenuItem value="member">Member</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </Select>
        </FormControl>

        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          sx={{ height: 40, mt: 0.25 }}
          aria-label="Send invitation"
        >
          {loading ? "Sending…" : "Send invite"}
        </Button>
      </Box>
    </Box>
  );
}
