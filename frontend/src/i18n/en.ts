export const en = {
  auth: {
    fields: {
      fullName: "Full name",
      fullNamePlaceholder: "Jane Smith",
      email: "Email",
      emailPlaceholder: "jane@example.com",
      password: "Password",
      confirmPassword: "Confirm password",
    },
    login: {
      title: "Sign in to your account",
      subtitle: "Welcome back. Enter your details to continue.",
      submit: "Sign in",
      noAccount: "Don't have an account?",
      createAccount: "Create one",
      signedInTitle: "You're signed in",
      signedInMessage: "This placeholder will become the WorkspaceCanvas dashboard.",
      mfaRequiredTitle: "MFA verification required",
      mfaRequiredMessage:
        "We received your MFA challenge. The verification screen will be added next.",
    },
    verifyEmail: {
      title: "Verify your email",
      subtitle: "We are checking your verification link.",
      verifyingTitle: "Verifying your email",
      verifyingMessage: "Please wait while we verify your email address.",
      successTitle: "Email verified",
      successMessage: "Your email address has been verified successfully. You can now sign in.",
      errorTitle: "Verification failed",
      missingTokenMessage:
        "This verification link is missing a token. Please use the link from your email.",
      expiredOrInvalidMessage: "This verification link is invalid or has expired.",
      backToLogin: "Back to login",
      goToLogin: "Go to login",
      resendTitle: "Need a new link?",
      resendSubtitle: "Enter your email and we will send another verification link.",
      resendSubmit: "Resend verification email",
      resendSuccess: "If that email is registered and unverified, a new link has been sent.",
    },
    mfaChallenge: {
      title: "Verify your identity",
      subtitle: "Enter the 6-digit code from your authenticator app.",
      recoverySubtitle: "Use one of your recovery codes instead.",
      codeLabel: "Authenticator code",
      codePlaceholder: "123456",
      recoveryCodeLabel: "Recovery code",
      recoveryCodePlaceholder: "Enter recovery code",
      submit: "Verify",
      useRecoveryCode: "Use a recovery code",
      useAuthenticatorCode: "Use authenticator code",
      backToLogin: "Back to login",
      missingChallengeTitle: "MFA challenge not found",
      missingChallengeMessage: "Please sign in again to start a new MFA challenge.",
      invalidCodeRequired: "Enter your authenticator code.",
      invalidCodeFormat: "Enter a valid 6-digit code.",
      recoveryCodeRequired: "Enter your recovery code.",
      verifyingMessage: "Verifying...",
      successMessage: "MFA verified successfully.",
    },
    signup: {
      title: "Create your account",
      subtitle: "We'll send a verification link to your email.",
      submit: "Create account",
      alreadyHaveAccount: "Already have an account?",
      signIn: "Sign in",
      successTitle: "Check your email",
      successMessage: "We sent a verification link to",
      verificationRequired: "You need to verify your email before you can sign in.",
      backToSignIn: "Back to sign in",
    },
    mfaSetup: {
      title: "Set up two-factor authentication",
      scanSubtitle:
        "Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.",
      confirmLabel: "Authenticator code",
      confirmPlaceholder: "123456",
      confirmSubmit: "Enable MFA",
      manualEntry: "Can't scan? Enter this code manually:",
      codesTitle: "Save your recovery codes",
      codesSubtitle:
        "Store these codes in a safe place. Each can be used once to sign in if you lose access to your authenticator app.",
      codesDone: "I've saved my recovery codes",
      loadingMessage: "Setting up your authenticator...",
      invalidCodeRequired: "Enter your authenticator code.",
      invalidCodeFormat: "Enter a valid 6-digit code.",
      setupInitError: "Failed to initialize MFA setup. Please try again.",
      setupVerificationError:
        "Verification failed. Make sure your device clock is correct and try again.",
    },
    session: {
      loading: "Checking your session...",
      sessionExpired: "Your session has expired. Please sign in again.",
      logout: "Log out",
      logoutFailed: "We could not log you out. Please try again.",
      signedOut: "You have been signed out.",
      protectedRouteLoading: "Loading your workspace...",
      unauthenticatedRedirect: "Please sign in to continue.",
    },
    social: {
      orDivider: "or",
      continueWithGoogle: "Continue with Google",
      continueWithMicrosoft: "Continue with Microsoft",
      loadingGoogle: "Connecting to Google...",
      loadingMicrosoft: "Connecting to Microsoft...",
      googleError: "Google sign-in failed. Please try again.",
      microsoftError: "Microsoft sign-in failed. Please try again.",
      googleUnavailable: "Google login is not configured.",
      microsoftUnavailable: "Microsoft login is not configured.",
      popupClosed: "Login was cancelled.",
    },
    validation: {
      fullNameMaxLength: "Full name must be 255 characters or fewer.",
      emailRequired: "Email is required.",
      invalidEmail: "Enter a valid email address.",
      passwordRequired: "Password is required.",
      passwordMinLength: "Password must be at least 8 characters.",
      passwordNoUpper: "Password must contain at least one uppercase letter.",
      passwordNoNumber: "Password must contain at least one number.",
      passwordNoSpecial: "Password must contain at least one special character.",
      confirmPasswordRequired: "Please confirm your password.",
      passwordMismatch: "Passwords do not match.",
    },
  },
  app: {
    shell: {
      brand: "WorkspaceCanvas",
      logout: "Log out",
      openNav: "Open navigation",
      workspaceSwitcherLabel: "Workspace",
    },
    sidebar: {
      lockedTooltip: "Complete your profile to unlock this section.",
      dashboard: "Dashboard",
      offices: "Offices",
      deskBooking: "Desk Booking",
      myBookings: "My Bookings",
      events: "Events",
      people: "People",
      almostThereTitle: "Almost there",
      almostThereBody: "Complete your profile to unlock the workspace tools.",
    },
    profile: {
      setupTitle: "Complete your profile",
      setupSubtitle: "Add a few details to get started with your workspace.",
      fullName: "Full name",
      fullNameRequired: "Full name is required.",
      jobTitle: "Job title",
      phoneNumber: "Phone number",
      saveButton: "Complete profile",
      phoneNumberInvalid: "Enter a valid phone number (digits, spaces, +, (, ), - only).",
      carousel: {
        // Short labels for step progress indicator
        stepWelcome: "Welcome",
        stepName: "Name",
        stepEmail: "Email",
        stepWorkDetails: "Work",
        stepAvatar: "Photo",
        stepDone: "Finish",

        stepWelcomeTitle: "Welcome to WorkspaceCanvas",
        stepWelcomeSubtitle:
          "Let's set up your profile so your team can recognize you when booking desks, joining events, and planning office days.",
        stepWelcomeCta: "Get started",

        stepNameTitle: "What should we call you?",
        stepNameSubtitle: "This name will be visible to teammates when you book a desk.",

        stepEmailTitle: "Confirm your sign-in email",
        stepEmailSubtitle: "This is the email connected to your WorkspaceCanvas account.",
        stepEmailVerifiedLabel: "Verified",

        stepWorkDetailsTitle: "A few work details",
        stepWorkDetailsSubtitle: "Optional details help your team understand who's booking what.",

        stepAvatarTitle: "Add a profile photo",
        stepAvatarSubtitle: "Optional, but helpful for teammates to recognize you at a glance.",

        stepDoneGreeting: "You're ready to go",
        stepDoneTitle: "You're all set!",
        stepDoneSubtitle:
          "Your profile is ready. Next, you'll be able to create or join a workspace.",
        stepDoneProfileComplete: "Profile complete",

        stepWelcomeFeatureDesks: "Desks",
        stepWelcomeFeatureEvents: "Events",
        stepWelcomeFeatureTeams: "Teams",

        next: "Next",
        back: "Back",
        skip: "Skip",
        finish: "Complete profile",
        completingTitle: "Setting up your workspace…",

        avatarUploadLabel: "Upload photo",
        avatarChangeLabel: "Change photo",
        avatarRemoveLabel: "Remove photo",
        avatarTooLarge: "Photo must be 2 MB or smaller.",
        avatarInvalidType: "Only JPEG, PNG, and WebP images are supported.",
        avatarPreviewAlt: "Profile photo preview",

        timezoneLabel: "Timezone",
        timezoneHelper: "e.g. Europe/Dublin, America/New_York, UTC",
        timezoneInvalid: "Enter a valid IANA timezone.",
        profileCompletion: "Profile completion",
      },
    },
    orgSetup: {
      stepWelcome: "Welcome",
      stepName: "Name",
      stepType: "Type",
      stepDomain: "Domain",
      stepReview: "Review",

      stepWelcomeTitle: "Set up your workspace",
      stepWelcomeSubtitle:
        "Create an organization to manage your offices, book desks, and invite your team.",
      stepWelcomeCta: "Get started",

      stepNameTitle: "What's your organization called?",
      stepNameSubtitle: "This name will be visible to everyone in your workspace.",
      nameLabel: "Organization name",
      namePlaceholder: "Acme Corp",
      nameRequired: "Organization name is required.",

      stepTypeTitle: "What kind of organization is it?",
      stepTypeSubtitle: "Choose the option that best describes your workspace.",
      typeCompany: "Company",
      typeCompanyDescription: "A business or startup with a dedicated team.",
      typeCoworking: "Co-working Space",
      typeCoworkingDescription: "A shared workspace open to multiple tenants.",
      typeOther: "Other",
      typeOtherDescription: "A non-profit, community space, or something else.",

      stepDomainTitle: "Restrict sign-up by email domain?",
      stepDomainSubtitle:
        "Optional. Limit who can join your organization to people with a matching email domain.",
      domainLabel: "Email domain",
      domainPlaceholder: "example.com",
      domainSkipHint: "Leave blank to allow any email address.",

      stepReviewTitle: "Review and create",
      stepReviewSubtitle: "Confirm the details below before creating your organization.",
      reviewNameLabel: "Name",
      reviewTypeLabel: "Type",
      reviewDomainLabel: "Allowed domain",
      reviewDomainNone: "Any email address",

      createButton: "Create organization",

      next: "Next",
      back: "Back",
      skip: "Skip",

      emptyStateTitle: "No offices yet",
      emptyStateSubtitle:
        "Your organization has been set up. Offices will appear here once you add them.",
      emptyStateAction: "Add your first office",
    },
    offices: {
      // Step labels
      stepWelcome: "Welcome",
      stepName: "Name",
      stepLocation: "Location",
      stepReview: "Review",

      // Welcome step
      stepWelcomeTitle: "Create your first office",
      stepWelcomeSubtitle:
        "This is where your team will build floor maps, manage desks, and book seats.",
      stepWelcomeCta: "Get started",

      // Name step
      stepNameTitle: "What's this office called?",
      stepNameSubtitle: "This name will be visible to everyone in your workspace.",
      nameLabel: "Office name",
      namePlaceholder: "Dublin Office",
      nameRequired: "Office name is required.",

      // Location step
      stepLocationTitle: "Where is this office?",
      stepLocationSubtitle: "All fields are optional. Add as much or as little as you like.",
      addressLine1Label: "Address line 1",
      addressLine1Placeholder: "123 Main Street",
      addressLine2Label: "Address line 2",
      addressLine2Placeholder: "Suite 200",
      cityLabel: "City",
      cityPlaceholder: "Dublin",
      countyOrStateLabel: "County / State",
      countyOrStatePlaceholder: "County Dublin",
      countryLabel: "Country",
      countryPlaceholder: "Ireland",
      timezoneLabel: "Timezone",
      timezonePlaceholder: "Europe/Dublin",
      timezoneHelper: "e.g. Europe/Dublin, America/New_York, UTC",
      timezoneInvalid: "Enter a valid IANA timezone (e.g. Europe/Dublin, UTC).",

      // Review step
      stepReviewTitle: "Review and create",
      stepReviewSubtitle: "Confirm the details below before creating your office.",
      reviewNameLabel: "Office name",
      reviewLocationLabel: "Location",
      reviewTimezoneLabel: "Timezone",
      reviewLocationNone: "No location added",
      reviewTimezoneNone: "No timezone set",

      createButton: "Create office",
      next: "Next",
      back: "Back",
      skip: "Skip",

      // List
      listTitle: "Offices",

      // Empty state (admin)
      emptyStateTitle: "No offices yet",
      emptyStateSubtitle:
        "Your organization has been set up. Add your first office to get started.",
      emptyStateAction: "Add your first office",
      // Empty state (member — read-only)
      emptyStateMemberTitle: "No offices available",
      emptyStateMemberSubtitle: "Your admin hasn't added any offices yet. Check back later.",

      // Office card / list
      addOffice: "Add office",
      manageFloors: "Manage floors",
      noCity: "Location not set",
      noTimezone: "Timezone not set",
      activeLabel: "Active",
    },
    floors: {
      // Step labels
      stepDetails: "Floor details",
      stepReview: "Review",

      // Details step
      stepDetailsTitle: "Floor details",
      stepDetailsSubtitle: "Enter the floor name and level number.",
      nameLabel: "Floor name",
      namePlaceholder: "Ground Floor",
      nameRequired: "Floor name is required.",
      levelLabel: "Level number",
      levelPlaceholder: "0",
      levelHelper: "Use 0 for ground floor, 1 for first floor, -1 for basement.",
      levelInvalid: "Level number must be an integer.",

      // Review step
      stepReviewTitle: "Review and create",
      stepReviewSubtitle: "Confirm the details below before creating your floor.",
      reviewNameLabel: "Floor name",
      reviewLevelLabel: "Level number",

      createButton: "Create floor",
      next: "Next",
      back: "Back",
      cancel: "Cancel",

      // List
      listTitle: "Floors",
      addFloor: "Add floor",

      // Empty state (admin)
      emptyStateTitle: "No floors yet",
      emptyStateSubtitle: "Create your first floor before building a map or adding desks.",
      emptyStateAction: "Create first floor",
      // Empty state (member — read-only)
      emptyStateMemberTitle: "No floors available",
      emptyStateMemberSubtitle:
        "Your admin hasn't added any floors to this office yet. Check back later.",

      // Floor card
      level: "Level",
      activeLabel: "Active",
      manageLayout: "Manage layout",

      // Office detail page
      backToOffices: "Back to offices",
    },
    layoutObjects: {
      // Page
      pageTitle: "Floor layout",
      backToFloors: "Back to floors",

      // Object library
      libraryTitle: "Object library",

      // Empty state (admin)
      emptyStateTitle: "No layout objects yet",
      emptyStateSubtitle:
        "Add objects like desks, tables, doors, windows, plants, and meeting pods to start shaping this floor.",
      // Empty state (member — read-only, layout not set up)
      emptyStateMemberTitle: "Floor map not set up yet",
      emptyStateMemberSubtitle:
        "This floor has no layout objects. Your admin hasn't built the map for this floor yet.",

      // Create form
      createFormTitle: "Add object",
      objectTypeLabel: "Object type",
      objectTypeRequired: "Select an object type.",
      labelLabel: "Label",
      labelPlaceholder: "e.g. Desk A1",
      labelMaxLength: "Label must be 120 characters or fewer.",
      xLabel: "X position",
      yLabel: "Y position",
      widthLabel: "Width",
      heightLabel: "Height",
      rotationLabel: "Rotation (deg)",
      isBookableLabel: "Bookable",
      positionRequired: "Position is required.",
      positionInvalid: "Enter a valid number.",
      sizeRequired: "Size is required.",
      sizePositive: "Must be greater than 0.",
      sizeInvalid: "Enter a valid number.",
      rotationInvalid: "Enter a valid number.",
      addButton: "Add object",

      // Object list
      listTitle: "Layout objects",
      typeColumn: "Type",
      labelColumn: "Label",
      positionColumn: "Position",
      sizeColumn: "Size (W × H)",
      rotationColumn: "Rotation",
      bookableColumn: "Bookable",
      deleteButton: "Delete",

      // Categories
      categoryWorkstations: "Workstations",
      categorySeating: "Seating",
      categoryTables: "Tables",
      categoryRoomsZones: "Rooms & Zones",
      categoryStructure: "Structure",
      categoryFacilities: "Facilities",
      categoryDecor: "Decor",

      // Canvas
      canvasTitle: "Floor map",
      canvasAriaLabel: "Floor map canvas",
      canvasEmptyTitle: "Nothing on this floor yet",
      canvasEmptySubtitle: "Add objects from the library to start building the layout.",
      canvasLoading: "Loading map canvas…",

      // Inspector
      inspectorTitle: "Inspector",
      inspectorEmpty: "Select an object to inspect its details.",
      inspectorTypeLabel: "Type",
      inspectorLabelField: "Label",
      inspectorPosition: "Position",
      inspectorSize: "Size (W × H)",
      inspectorRotation: "Rotation (deg)",
      inspectorBookable: "Bookable",
      inspectorMetadata: "Metadata",
      inspectorNoLabel: "(no label)",
      inspectorYes: "Yes",
      inspectorNo: "No",
      inspectorSaving: "Saving…",
      inspectorSaved: "Saved",

      // Canvas toolbar (grid / snap controls)
      toolbarShowGrid: "Show grid",
      toolbarSnapToGrid: "Snap to grid",
      toolbarGridSize: "Grid size:",

      // Drag / transform persistence
      moveError: "Could not save layout changes. Please try again.",
      movePermissionError: "You do not have permission to edit this layout.",
      readOnlyBanner: "You can view this layout, but only owners and admins can make changes.",

      // Keyboard movement hints
      keyboardHint: "Tap arrow keys to move. Hold Shift for 10 px steps.",
      keyboardHintSnap: "Tap arrow keys to move by one grid step.",
    },
    desks: {
      // Panel
      panelTitle: "Desk Resource",
      notDeskCapable: "This object type cannot be set up as a bookable desk.",
      noDesk: "Not yet set up as a bookable desk.",
      createAction: "Set up as bookable desk",
      deactivateAction: "Remove desk",

      // Form labels
      nameLabel: "Desk name",
      namePlaceholder: "e.g. Desk A1",
      nameRequired: "Desk name is required.",
      codeLabel: "Code (optional)",
      codePlaceholder: "e.g. A1",
      statusLabel: "Status",
      amenitiesLabel: "Amenities",
      notesLabel: "Notes",
      notesPlaceholder: "Any additional notes…",
      submitCreate: "Create desk",
      editAction: "Edit desk",
      submitEdit: "Save changes",
      cancelEdit: "Cancel",
      editError: "Could not update desk. Please try again.",
      editErrorPermission: "You do not have permission to edit this desk.",

      // Status display
      statusAvailable: "Available",
      statusUnavailable: "Unavailable",
      statusMaintenance: "Maintenance",

      // Amenities checkboxes
      amenityMonitor: "Monitor",
      amenityDockingStation: "Docking station",
      amenityStandingDesk: "Standing desk",
      amenityNearWindow: "Near window",

      // Feedback
      bookableBadge: "Bookable",
      createError: "Could not create desk. Please try again.",
      createErrorPermission: "You do not have permission to create a desk here.",
      createErrorValidation: "Please check your input and try again.",
      deactivateError: "Could not remove desk. Please try again.",
    },
    pages: {
      comingSoon: "This feature is coming soon.",
    },
    people: {
      pageTitle: "People",
      inviteTitle: "Invite a team member",
      inviteSendButton: "Send invite",
      inviteSending: "Sending…",
      inviteSuccess: "Invitation sent successfully.",
      pendingTitle: "Pending invitations",
      membersTitle: "Team members",
      noPending: "No pending invitations",
      noPendingDesc: "Invite people above to share your workspace.",
      noMembers: "No members yet",
      noMembersDesc: "You are the only member of this workspace.",
      noOrg: "No workspace yet",
      noOrgDesc: "You are not part of any organization. Create or join one to manage your team.",
      copyLink: "Copy",
      copied: "Copied",
      cancelInvite: "Cancel invitation",
      resendInvite: "Resend",
      resending: "Resending…",
      resendSuccess: "Invitation resent to {email}.",
      resendError: "Could not resend the invitation. Please try again.",
      roleOwner: "Owner",
      roleAdmin: "Admin",
      roleMember: "Member",
    },
    placeholder: {
      title: "Welcome to WorkspaceCanvas",
      subtitle: "Your workspace dashboard will appear here.",
      email: "Email",
      name: "Name",
      organizations: "Organizations",
      noOrganizationsTitle: "No organization yet",
      noOrganizationsMessage:
        "You are not part of any organization yet. Organization setup and invitations will be added next.",
    },
    dashboard: {
      greetingMorning: "Good morning",
      greetingAfternoon: "Good afternoon",
      greetingEvening: "Good evening",
      heroAdminSetup: "Finish setting up your workspace",
      heroAdminReady: "Your workspace is ready",
      heroMember: "Book your next office day",
      heroMemberSetup: "Your workspace is being set up",
      heroNoOrg: "Get started with WorkspaceCanvas",
      noOrgTitle: "No workspace yet",
      noOrgMessage:
        "You are not part of any organization. Create one to manage offices and bookings, or ask your team admin for an invite.",
      createOrgAction: "Create workspace",
      todayTitle: "Today",
      noBookingTodayTitle: "No booking today",
      noBookingTodayMessage: "You don't have a desk booked for today.",
      bookDeskAction: "Book a desk",
      viewMyBookings: "View my bookings",
      upcomingTitle: "Upcoming",
      loadingBookings: "Loading your bookings…",
      bookingFloorLabel: "Floor",
      setupTitle: "Workspace setup",
      setupProgressLabel: "Setup progress",
      checklistItemProfileLabel: "Profile complete",
      checklistItemProfileDesc: "Your profile details are saved.",
      checklistItemOrgLabel: "Organization created",
      checklistItemOrgDesc: "You are part of an organization.",
      checklistItemOfficeLabel: "First office created",
      checklistItemOfficeDesc: "Add your first office to start managing desks.",
      checklistItemOfficeAction: "Add office",
      checklistItemFloorLabel: "First floor created",
      checklistItemFloorDesc: "Add a floor to your office.",
      checklistItemFloorAction: "Manage floors",
      checklistItemDesksLabel: "Bookable desks added",
      checklistItemDesksDesc: "Build the floor map and mark desks as bookable.",
      checklistItemDesksAction: "Build floor map",
      checklistItemInviteLabel: "Invite team members",
      checklistItemInviteDesc: "Invite people to your workspace from the People page.",
      checklistItemInviteAction: "Invite people",
      checklistItemDeferred: "Coming soon",
      healthTitle: "Workspace overview",
      healthOffices: "Offices",
      healthFloors: "Floors",
      healthDesks: "Bookable desks",
      quickActionsTitle: "Quick actions",
      actionManageOffices: "Manage offices",
      actionBuildFloorMap: "Build floor map",
      actionBookDesk: "Book a desk",
      actionMyBookings: "My bookings",
      actionCreateOrg: "Create workspace",
      actionInvitePeople: "Invite people",
      memberSetupTitle: "Workspace is being set up",
      memberSetupDesc:
        "Your admin is still configuring the workspace. You'll be able to book desks once bookable desks are available.",
    },
  },
  myBookings: {
    pageTitle: "My Bookings",
    bookDeskAction: "Book a desk",
    emptyTitle: "No upcoming bookings",
    emptyDesc: "You don't have any active desk bookings.",
  },
  bookings: {
    pageTitle: "Desk Booking",
    selectPrompt: "Select an office and floor to view desk availability.",
    noOfficesAdminTitle: "No offices yet",
    noOfficesAdminDesc: "Create your first office to enable desk booking.",
    noOfficesAdminAction: "Manage offices",
    noOfficesMemberTitle: "No offices available",
    noOfficesMemberDesc: "Your workspace has no offices set up yet. Contact your admin.",
    noFloorsAdminTitle: "No floors yet",
    noFloorsAdminDesc: "Add a floor to this office before booking desks.",
    noFloorsAdminAction: "Manage floors",
    noFloorsMemberTitle: "No floors available",
    noFloorsMemberDesc: "This office has no floors set up yet. Contact your admin.",
    noDesksTitle: "No bookable desks",
    noDesksAdminDesc: "Build the floor map and mark desks as bookable.",
    noDesksAdminAction: "Build floor map",
    noDesksMemberDesc: "No desks are available to book on this floor yet. Contact your admin.",
  },
  common: {
    somethingWentWrong: "Something went wrong. Please try again.",
  },
} as const;
