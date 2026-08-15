import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

import { NAV_ITEMS, isNavItemActive } from "./navItems";
import * as s from "./BottomTabBar.styles";

/**
 * Phone-only bottom tab bar (PR 079 responsive). Carries the 4 primary destinations
 * (`bottomBar` items); People is reached from the Today screen on phone. Hidden at `sm`
 * and up, where the icon rail / full sidebar take over.
 */
export function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const items = NAV_ITEMS.filter((i) => i.bottomBar);
  const activeIndex = items.findIndex((i) => isNavItemActive(i, location.pathname));

  return (
    <Paper elevation={0} square sx={s.paper}>
      <BottomNavigation
        showLabels
        value={activeIndex === -1 ? false : activeIndex}
        onChange={(_, idx: number) => navigate(items[idx].path)}
        sx={s.nav}
      >
        {items.map((item) => {
          const { id, label, Icon } = item;
          return (
            <BottomNavigationAction
              key={id}
              label={label}
              icon={<Icon fontSize="small" />}
              aria-label={label}
              sx={s.action}
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
}
