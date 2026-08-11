'use client';
import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/SpaceDashboardOutlined';
import PendingIcon from '@mui/icons-material/HourglassEmptyOutlined';
import ImpactedIcon from '@mui/icons-material/ReportProblemOutlined';
import CompletedIcon from '@mui/icons-material/TaskAltOutlined';
import CancelledIcon from '@mui/icons-material/CancelOutlined';
import ExceptionIcon from '@mui/icons-material/ErrorOutlineOutlined';
import OrdersIcon from '@mui/icons-material/ListAltOutlined';
import ImportsIcon from '@mui/icons-material/CloudUploadOutlined';
import SourcesIcon from '@mui/icons-material/HubOutlined';
import RulesIcon from '@mui/icons-material/RuleOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import TowerIcon from '@mui/icons-material/CellTowerOutlined';
import { useAppStore } from '@/store';
import { OrderDrawer } from './OrderDrawer';

const DRAWER_WIDTH = 248;

const NAV = [
  { section: 'Overview', items: [{ href: '/', label: 'Control Tower', icon: <DashboardIcon /> }] },
  {
    section: 'Queues',
    items: [
      { href: '/queues/pending', label: 'Pending', icon: <PendingIcon /> },
      { href: '/queues/customer-impacted', label: 'Customer Impacted', icon: <ImpactedIcon /> },
      { href: '/queues/completed', label: 'Completed', icon: <CompletedIcon /> },
      { href: '/queues/cancelled', label: 'Cancelled', icon: <CancelledIcon /> },
      { href: '/queues/exceptions', label: 'Exceptions', icon: <ExceptionIcon /> },
      { href: '/orders', label: 'All Orders', icon: <OrdersIcon /> },
    ],
  },
  {
    section: 'Operations',
    items: [{ href: '/imports', label: 'Import History', icon: <ImportsIcon /> }],
  },
  {
    section: 'Settings',
    items: [
      { href: '/settings/sources', label: 'Data Sources', icon: <SourcesIcon /> },
      { href: '/settings/rules', label: 'Classification Rules', icon: <RulesIcon /> },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { sidebarOpen, toggleSidebar } = useAppStore();

  const drawerContent = (
    <Box role="navigation" aria-label="Main navigation">
      <Toolbar sx={{ gap: 1.5 }}>
        <TowerIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.3 }}>
          Control Tower
        </Typography>
      </Toolbar>
      <Divider />
      {NAV.map((group) => (
        <List
          key={group.section}
          dense
          subheader={
            <ListSubheader sx={{ bgcolor: 'transparent', lineHeight: '32px' }}>
              {group.section}
            </ListSubheader>
          }
        >
          {group.items.map((item) => {
            const selected =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={selected}
                sx={{
                  mx: 1,
                  borderRadius: 1.5,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(0,127,163,0.10)',
                    color: 'primary.dark',
                    '& .MuiListItemIcon-root': { color: 'primary.dark' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            );
          })}
        </List>
      ))}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: 'background.paper' }}
      >
        <Toolbar>
          <IconButton edge="start" aria-label="Toggle navigation" onClick={toggleSidebar} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Order Control Tower
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Operational visibility · live
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isDesktop ? 'persistent' : 'temporary'}
        open={sidebarOpen}
        onClose={toggleSidebar}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          ml: isDesktop && sidebarOpen ? 0 : `-${isDesktop ? DRAWER_WIDTH : 0}px`,
          transition: 'margin 200ms',
          width: '100%',
          minWidth: 0,
        }}
      >
        <Toolbar />
        {children}
      </Box>

      <OrderDrawer />
    </Box>
  );
}
