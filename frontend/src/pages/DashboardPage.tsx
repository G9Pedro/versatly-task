import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { workspaceService } from '../services/workspaceService';
import { boardService } from '../services/boardService';
import { listService } from '../services/listService';
import { cardService } from '../services/cardService';
import { useAuthStore } from '../store/authStore';
import { useConfirmModal } from '../hooks/useConfirmModal';
import WorkspaceMembersModal from '../components/WorkspaceMembersModal';
import WorkspaceActivityFeed from '../components/WorkspaceActivityFeed';
import NotificationDropdown from '../components/common/NotificationDropdown';
import NotificationProvider from '../components/common/NotificationProvider';
import SettingsModal from '../components/common/SettingsModal';

// Board Templates
const BOARD_TEMPLATES = [
  {
    id: 'kanban',
    name: 'Kanban',
    icon: '📋',
    description: 'Fluxo de trabalho visual',
    lists: ['Backlog', 'A fazer', 'Em progresso', 'Em revisão', 'Concluído'],
  },
  {
    id: 'projeto',
    name: 'Projeto',
    icon: '🎯',
    description: 'Gestão simples de projeto',
    lists: ['Planejamento', 'A fazer', 'Fazendo', 'Feito'],
  },
  {
    id: 'sprint',
    name: 'Sprint',
    icon: '🚀',
    description: 'Desenvolvimento ágil',
    lists: ['Sprint Backlog', 'Em desenvolvimento', 'Code Review', 'QA', 'Done'],
  },
  {
    id: 'bugs',
    name: 'Bug Tracking',
    icon: '🐛',
    description: 'Rastreamento de bugs',
    lists: ['Reportado', 'Investigando', 'Em correção', 'Corrigido', 'Fechado'],
  },
  {
    id: 'conteudo',
    name: 'Conteúdo',
    icon: '📝',
    description: 'Pipeline de conteúdo',
    lists: ['Ideias', 'Rascunho', 'Em revisão', 'Aprovado', 'Publicado'],
  },
  {
    id: 'design',
    name: 'Design',
    icon: '🎨',
    description: 'Processo de design',
    lists: ['Briefing', 'Wireframe', 'Design', 'Revisão', 'Aprovado'],
  },
];

// Inject keyframes once
const dpStyleId = 'dashboard-page-keyframes';
function injectDashboardKeyframes() {
  if (document.getElementById(dpStyleId)) return;
  const style = document.createElement('style');
  style.id = dpStyleId;
  style.textContent = `
    @keyframes dp-fadeInUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes dp-fadeInScale {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes dp-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes dp-highlight-pulse {
      0% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0); }
      20% { box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.3); }
      40% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0); }
      60% { box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2); }
      100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0); }
    }
    .dp-section-highlight {
      animation: dp-highlight-pulse 1.2s ease-out;
      border-radius: 12px;
    }

    /* Sidebar scrollbar */
    .dp-workspace-list::-webkit-scrollbar { width: 4px; }
    .dp-workspace-list::-webkit-scrollbar-thumb { background: var(--accent-bg-strong); border-radius: 2px; }

    /* Main scrollbar */
    .dp-main::-webkit-scrollbar { width: 6px; }
    .dp-main::-webkit-scrollbar-track { background: transparent; }
    .dp-main::-webkit-scrollbar-thumb { background: var(--border-accent-medium); border-radius: 3px; }
    .dp-main::-webkit-scrollbar-thumb:hover { background: var(--accent-bg-strong); }

    /* Favorites row scrollbar */
    .dp-favorites-row::-webkit-scrollbar { height: 4px; }
    .dp-favorites-row::-webkit-scrollbar-thumb { background: var(--border-accent-medium); border-radius: 2px; }

    /* Search bar focus styling */
    .dp-search-bar:focus-within {
      border-color: var(--accent-bg-strong) !important;
      background: var(--surface-card-solid) !important;
      box-shadow: 0 0 20px var(--accent-bg) !important;
    }

    /* Board card hover effects */
    .dp-board-card:hover .dp-board-overlay {
      background: linear-gradient(160deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.3) 100%) !important;
    }
    .dp-board-card:hover .dp-board-menu-btn {
      opacity: 0.7 !important;
    }
    .dp-board-card:hover .dp-board-fav-btn {
      opacity: 1 !important;
    }
    .dp-board-menu-btn:hover {
      opacity: 1 !important;
      background: rgba(255,255,255,0.2) !important;
    }

    /* Fav card hover */
    .dp-fav-card:hover .dp-fav-card-overlay {
      background: linear-gradient(135deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.25) 100%) !important;
    }

    /* Create board card hover */
    .dp-board-card-new:hover {
      border-color: var(--accent-bg-strong) !important;
      background: var(--accent-bg-subtle) !important;
      transform: translateY(-2px);
    }
    .dp-board-card-new:hover .dp-new-icon {
      background: var(--accent-bg-strong) !important;
      transform: rotate(90deg);
    }

    /* Nav item hover */
    .dp-nav-item:hover {
      color: var(--text-secondary) !important;
      background: var(--border-subtle);
    }

    /* Workspace sidebar item hover */
    .dp-ws-sidebar-item:hover {
      background: var(--border-subtle);
    }

    /* User card hover */
    .dp-user-card:hover {
      border-color: var(--border-accent-medium) !important;
      background: var(--surface-card-solid) !important;
    }

    /* Stat card hover */
    .dp-stat-card:hover {
      border-color: var(--accent-bg-medium) !important;
      background: var(--surface-card-solid) !important;
    }

    /* Notification btn hover */
    .dp-notif-btn:hover {
      color: var(--text-secondary) !important;
      border-color: var(--accent-bg-strong) !important;
    }

    /* Section add btn hover */
    .dp-section-btn:hover {
      background: var(--accent-bg-strong) !important;
      transform: scale(1.1);
    }

    /* WS more btn hover */
    .dp-ws-more-btn:hover {
      background: var(--surface-subtle) !important;
      color: var(--text-secondary) !important;
    }

  `;
  document.head.appendChild(style);
}

// Dashboard Page Component
export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm: confirmAction, ConfirmDialog } = useConfirmModal();
  const [showModal, setShowModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState<string | null>(null);
  const [boardMenuOpen, setBoardMenuOpen] = useState<string | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [editingBoard, setEditingBoard] = useState<{ id: string; name: string; color: string } | null>(null);
  const [showCreateBoardModal, setShowCreateBoardModal] = useState<{ workspaceId: string } | null>(null);
  const [boardName, setBoardName] = useState('');
  const [boardColor, setBoardColor] = useState('#667eea');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [favoriteWorkspaces, setFavoriteWorkspaces] = useState<string[]>(() => {
    const saved = localStorage.getItem('favoriteWorkspaces');
    return saved ? JSON.parse(saved) : [];
  });
  const [favoriteBoards, setFavoriteBoards] = useState<string[]>(() => {
    const saved = localStorage.getItem('favoriteBoards');
    return saved ? JSON.parse(saved) : [];
  });
  const [workspaceMembersModal, setWorkspaceMembersModal] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Inject keyframes on mount
  useEffect(() => {
    injectDashboardKeyframes();
  }, []);

  // Close user menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Ctrl+K shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('favoriteWorkspaces', JSON.stringify(favoriteWorkspaces));
  }, [favoriteWorkspaces]);

  useEffect(() => {
    localStorage.setItem('favoriteBoards', JSON.stringify(favoriteBoards));
  }, [favoriteBoards]);

  const toggleFavoriteWorkspace = (workspaceId: string) => {
    setFavoriteWorkspaces(prev =>
      prev.includes(workspaceId)
        ? prev.filter(id => id !== workspaceId)
        : [...prev, workspaceId]
    );
  };

  const toggleFavoriteBoard = (boardId: string) => {
    setFavoriteBoards(prev =>
      prev.includes(boardId)
        ? prev.filter(id => id !== boardId)
        : [...prev, boardId]
    );
  };

  const { data, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspaceService.getWorkspaces(),
  });

  // Fetch boards for all workspaces
  const workspaces = data?.workspaces || [];
  const boardQueries = useQuery({
    queryKey: ['allBoards', workspaces.map(w => w.id)],
    queryFn: async () => {
      const results = await Promise.all(
        workspaces.map(workspace =>
          boardService.getBoards(workspace.id).then(data => ({
            workspaceId: workspace.id,
            boards: data.boards
          }))
        )
      );
      return results;
    },
    enabled: workspaces.length > 0,
  });

  // Fetch cards assigned to the current user
  const { data: myCardsData } = useQuery({
    queryKey: ['myCards'],
    queryFn: () => cardService.getMyCards(),
  });
  const myCards = myCardsData?.cards || [];
  const activeTasks = myCards.filter(c => !c.isCompleted).length;

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      workspaceService.createWorkspace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setShowModal(false);
      setName('');
      setDescription('');
    },
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: (id: string) => workspaceService.deleteWorkspace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setWorkspaceMenuOpen(null);
    },
  });

  const updateWorkspaceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; description?: string } }) =>
      workspaceService.updateWorkspace(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setEditingWorkspace(null);
    },
  });

  const createBoardMutation = useMutation({
    mutationFn: async (data: { workspaceId: string; name: string; backgroundColor?: string; templateId?: string | null }) => {
      const { templateId, ...boardData } = data;
      const result = await boardService.createBoard(boardData);
      // Create template lists if a template was selected
      if (templateId) {
        const template = BOARD_TEMPLATES.find(t => t.id === templateId);
        if (template) {
          for (let i = 0; i < template.lists.length; i++) {
            await listService.createList({
              boardId: result.board.id,
              title: template.lists[i],
              position: (i + 1) * 1000,
            });
          }
        }
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allBoards'] });
      setShowCreateBoardModal(null);
      setBoardName('');
      setBoardColor('#667eea');
      setSelectedTemplate(null);
    },
  });

  const updateBoardMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; backgroundColor?: string } }) =>
      boardService.updateBoard(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allBoards'] });
      setEditingBoard(null);
      setBoardMenuOpen(null);
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: (id: string) => boardService.deleteBoard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allBoards'] });
      setBoardMenuOpen(null);
    },
  });

  const reorderWorkspacesMutation = useMutation({
    mutationFn: (workspaces: { id: string; position: number }[]) =>
      workspaceService.reorderWorkspaces(workspaces),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  const handleWorkspaceDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(workspaces);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update positions
    const updatedWorkspaces = items.map((workspace, index) => ({
      id: workspace.id,
      position: index,
    }));

    // Optimistic update
    queryClient.setQueryData(['workspaces'], { workspaces: items });

    // Persist to backend
    reorderWorkspacesMutation.mutate(updatedWorkspaces);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      createMutation.mutate({ name, description });
    }
  };

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  const getBoardsForWorkspace = (workspaceId: string) => {
    const workspaceData = boardQueries.data?.find(w => w.workspaceId === workspaceId);
    return workspaceData?.boards || [];
  };

  // Workspace icon colors - cycling through different colors
  const workspaceIconColors = [
    { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'var(--accent)' },
    { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: '#f093fb' },
    { bg: 'linear-gradient(135deg, #0093E9 0%, #80D0C7 100%)', color: '#0093E9' },
    { bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', color: '#fcb69f' },
    { bg: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', color: '#a8edea' },
  ];

  // Board colors palette
  const boardColorClasses = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // blue
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // pink
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', // purple
    'linear-gradient(135deg, #0093E9 0%, #80D0C7 100%)', // teal
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', // orange
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', // green
  ];

  // Compute stats
  const totalBoards = workspaces.reduce((sum, ws) => sum + getBoardsForWorkspace(ws.id).length, 0);

  // Get initials from workspace name (first 2 letters)
  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  // Get user initials

  // Get all favorite board objects (for the favorites section)
  const allBoards = workspaces.flatMap(ws =>
    getBoardsForWorkspace(ws.id).map(b => ({ ...b, workspaceName: ws.name, workspaceId: ws.id }))
  );
  const favoriteBoardObjects = allBoards.filter(b => favoriteBoards.includes(b.id));

  // Filter boards by search query
  const filterBoards = (boards: any[]) => {
    if (!searchQuery.trim()) return boards;
    const q = searchQuery.toLowerCase();
    return boards.filter((b: any) => b.name.toLowerCase().includes(q));
  };

  return (
    <>
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--surface-base)',
      color: 'var(--text-primary)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* ===== SIDEBAR ===== */}
      <div style={{
        width: 260,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-chrome)',
        backdropFilter: 'blur(24px)',
        borderRight: '1px solid var(--border-accent)',
        padding: '20px 14px',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Sidebar subtle glow */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 120,
          background: 'linear-gradient(180deg, var(--accent-bg-subtle) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        {/* Brand */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          marginBottom: 24,
          position: 'relative',
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
          }}>
            <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <span style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: -0.3,
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>VersatlyTask</span>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 24 }}>
          <Link
            to="/dashboard"
            className="dp-nav-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              color: 'var(--text-primary)',
              fontSize: 13.5,
              fontWeight: 600,
              textDecoration: 'none',
              position: 'relative',
              background: 'var(--gradient-nav-active)',
            }}
          >
            {/* Active left bar indicator */}
            <div style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 3,
              height: 20,
              borderRadius: '0 3px 3px 0',
              background: 'var(--gradient-nav-bar)',
            }} />
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Home</span>
          </Link>

          <button
            onClick={() => {
              const el = document.getElementById('section-workspaces');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Find the next sibling (the DragDropContext wrapper) to highlight
                const target = el.nextElementSibling;
                if (target) {
                  (target as HTMLElement).classList.add('dp-section-highlight');
                  setTimeout(() => (target as HTMLElement).classList.remove('dp-section-highlight'), 1300);
                }
              }
            }}
            className="dp-nav-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              color: 'var(--text-faint)',
              fontSize: 13.5,
              fontWeight: 500,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              position: 'relative',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            <span>Meus Boards</span>
            <span style={{
              marginLeft: 'auto',
              background: 'var(--accent-bg-strong)',
              color: 'var(--accent)',
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 10,
            }}>{totalBoards}</span>
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('section-favorites');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                el.classList.add('dp-section-highlight');
                setTimeout(() => el.classList.remove('dp-section-highlight'), 1300);
              }
            }}
            className="dp-nav-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              color: 'var(--text-faint)',
              fontSize: 13.5,
              fontWeight: 500,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              position: 'relative',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <span>Favoritos</span>
            <span style={{
              marginLeft: 'auto',
              background: 'var(--accent-bg-strong)',
              color: 'var(--accent)',
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 10,
            }}>{favoriteBoards.length}</span>
          </button>

          <button
            onClick={() => setShowActivityModal(true)}
            className="dp-nav-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              color: 'var(--text-faint)',
              fontSize: 13.5,
              fontWeight: 500,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              position: 'relative',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Atividades</span>
          </button>
        </div>

        {/* Sidebar divider */}
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent, var(--accent-bg-medium), transparent)',
          margin: '4px 12px 16px',
        }} />

        {/* Workspace section header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          marginBottom: 8,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1,
            color: 'var(--text-dimmed)',
          }}>Workspaces</span>
          <button
            onClick={() => setShowModal(true)}
            className="dp-section-btn"
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent-bg)',
              color: 'var(--accent)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            title="Criar novo workspace"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
            </svg>
          </button>
        </div>

        {/* Workspace list */}
        <div className="dp-workspace-list" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flex: 1,
          overflowY: 'auto',
        }}>
          {workspaces.map((workspace, idx) => {
            const colorScheme = workspaceIconColors[idx % workspaceIconColors.length];
            const boardCount = getBoardsForWorkspace(workspace.id).length;
            return (
              <div
                key={workspace.id}
                className="dp-ws-sidebar-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'white',
                  background: colorScheme.bg,
                }}>{getInitials(workspace.name)}</div>
                <span style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>{workspace.name}</span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  color: 'var(--text-dimmed)',
                }}>{boardCount}</span>
              </div>
            );
          })}
        </div>

      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="dp-main" style={{
        flex: 1,
        overflowY: 'auto',
        position: 'relative',
      }}>
        {/* Subtle background pattern */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 260,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 0%, var(--accent-bg-subtle) 0%, transparent 60%), radial-gradient(circle at 80% 80%, var(--accent-bg-subtle) 0%, transparent 40%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
        {/* Dot grid */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 260,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(circle, var(--auth-grid-line) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black 10%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black 10%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        <div style={{
          position: 'relative',
          zIndex: 1,
          padding: '32px 40px',
          maxWidth: 1400,
        }}>
          {/* Top Bar / Greeting */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 32,
            animation: 'dp-fadeInUp 0.4s ease-out forwards',
            position: 'relative',
            zIndex: 100,
          }}>
            <div>
              <h1 style={{
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: -0.5,
                marginBottom: 4,
                color: 'var(--text-primary)',
                margin: 0,
              }}>
                {'Olá, '}
                <span style={{
                  background: 'var(--gradient-primary)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>{user?.name}</span>
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-disabled)', margin: 0, marginTop: 4 }}>
                Aqui esta o resumo dos seus workspaces e boards
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Search bar */}
              <div className="dp-search-bar" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 16px',
                borderRadius: 10,
                background: 'var(--surface-card-solid)',
                border: '1px solid var(--border-accent)',
                width: 280,
                transition: 'all 0.2s ease',
              }}>
                <svg width="16" height="16" fill="none" stroke="var(--text-dimmed)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar boards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    width: '100%',
                    fontFamily: 'inherit',
                  }}
                />
                <span style={{
                  fontSize: 10,
                  color: 'var(--text-disabled)',
                  border: '1px solid var(--accent-bg-medium)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  flexShrink: 0,
                }}>Ctrl+K</span>
              </div>

              {/* Notification bell */}
              <NotificationDropdown />

              {/* Settings gear */}
              <button
                onClick={() => setShowSettingsModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--surface-card-solid)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Configurações"
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--surface-card-solid)'; }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* User avatar menu */}
              <div style={{ position: 'relative' }} ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 10px 4px 4px',
                    borderRadius: 10,
                    border: '1px solid var(--border-accent)',
                    background: 'var(--surface-card-solid)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  title={user?.name}
                >
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      className="object-cover"
                      alt={user.name}
                      style={{ width: 30, height: 30, borderRadius: 8 }}
                    />
                  ) : (
                    <div style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: 'var(--gradient-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 700,
                    }}>
                      {user && getInitials(user.name)}
                    </div>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {user?.name?.split(' ')[0]}
                  </span>
                  <svg width="14" height="14" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showUserMenu && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: 8,
                    width: 220,
                    borderRadius: 14,
                    background: 'var(--surface-dropdown)',
                    border: '1px solid var(--border-accent)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user?.email}</div>
                    </div>
                    <button
                      onClick={() => { setShowUserMenu(false); navigate('/profile'); }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 16px',
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Editar perfil
                    </button>
                    <button
                      onClick={() => { setShowUserMenu(false); logout(); navigate('/login'); }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 16px',
                        border: 'none',
                        background: 'none',
                        color: '#ef4444',
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sair
                    </button>
                  </div>
                )}
              </div>

              {/* Create workspace button */}
              <button
                onClick={() => setShowModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--gradient-primary)',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  boxShadow: 'var(--shadow-glow)',
                  fontFamily: 'inherit',
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                </svg>
                Novo Workspace
              </button>
            </div>
          </div>

          {isLoading || boardQueries.isLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{
                    borderRadius: 16,
                    background: 'var(--surface-card-solid)',
                    border: '1px solid var(--border-subtle)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ height: 100, background: `linear-gradient(135deg, rgba(102, 126, 234, ${0.08 + i * 0.02}), rgba(118, 75, 162, ${0.05 + i * 0.02}))` }} />
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ height: 14, borderRadius: 6, background: 'var(--border-visible)', width: `${50 + i * 8}%`, marginBottom: 8 }} />
                    <div style={{ height: 10, borderRadius: 4, background: 'var(--border-subtle)', width: '40%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : workspaces.length === 0 ? (
            /* ===== EMPTY STATE ===== */
            <div style={{
              textAlign: 'center',
              padding: '80px 40px',
              background: 'var(--surface-card-solid)',
              borderRadius: 20,
              border: '1px dashed var(--accent-bg-medium)',
            }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                background: 'var(--accent-bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <svg width="36" height="36" fill="none" stroke="var(--accent)" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Nenhum workspace encontrado
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-disabled)', marginBottom: 24, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
                Crie seu primeiro workspace para organizar seus boards e tarefas.
              </div>
              <button
                onClick={() => setShowModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 28px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'var(--gradient-primary)',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  boxShadow: 'var(--shadow-glow)',
                  fontFamily: 'inherit',
                }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                </svg>
                Criar Primeiro Workspace
              </button>
            </div>
          ) : (
            <>
              {/* ===== QUICK STATS ===== */}
              <div style={{
                display: 'flex',
                gap: 14,
                marginBottom: 32,
                animation: 'dp-fadeInUp 0.4s ease-out forwards',
                animationDelay: '0.05s',
                opacity: 0,
              }}>
                {/* Workspaces stat */}
                <div className="dp-stat-card" style={{
                  flex: 1,
                  padding: '16px 20px',
                  borderRadius: 14,
                  background: 'var(--surface-card-solid)',
                  border: '1px solid var(--border-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    background: 'var(--accent-bg)', color: 'var(--accent)',
                  }}>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{workspaces.length}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 2 }}>Workspaces</div>
                  </div>
                </div>

                {/* Boards stat */}
                <div className="dp-stat-card" style={{
                  flex: 1,
                  padding: '16px 20px',
                  borderRadius: 14,
                  background: 'var(--surface-card-solid)',
                  border: '1px solid var(--border-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    background: 'rgba(240, 147, 251, 0.1)', color: '#f093fb',
                  }}>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{totalBoards}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 2 }}>Boards</div>
                  </div>
                </div>

                {/* Tarefas ativas stat */}
                <div className="dp-stat-card" style={{
                  flex: 1,
                  padding: '16px 20px',
                  borderRadius: 14,
                  background: 'var(--surface-card-solid)',
                  border: '1px solid var(--border-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    background: 'rgba(168, 237, 234, 0.1)', color: '#a8edea',
                  }}>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{activeTasks}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 2 }}>Tarefas ativas</div>
                  </div>
                </div>

                {/* Favoritos stat */}
                <div className="dp-stat-card" style={{
                  flex: 1,
                  padding: '16px 20px',
                  borderRadius: 14,
                  background: 'var(--surface-card-solid)',
                  border: '1px solid var(--border-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24',
                  }}>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{favoriteBoards.length}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 2 }}>Favoritos</div>
                  </div>
                </div>
              </div>

              {/* ===== FAVORITES SECTION ===== */}
              {favoriteBoardObjects.length > 0 && (
                <div id="section-favorites" style={{
                  animation: 'dp-fadeInUp 0.4s ease-out forwards',
                  animationDelay: '0.1s',
                  opacity: 0,
                  scrollMarginTop: 20,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}>
                      <svg width="18" height="18" fill="var(--accent)" viewBox="0 0 24 24">
                        <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      Favoritos
                    </div>
                  </div>
                  <div className="dp-favorites-row" style={{
                    display: 'flex',
                    gap: 12,
                    marginBottom: 36,
                    overflowX: 'auto',
                    paddingBottom: 4,
                  }}>
                    {favoriteBoardObjects.map((board, i) => {
                      const boardBg = board.backgroundColor || boardColorClasses[i % boardColorClasses.length];
                      return (
                        <Link
                          key={board.id}
                          to={`/board/${board.id}`}
                          className="dp-fav-card"
                          style={{
                            flexShrink: 0,
                            width: 200,
                            height: 80,
                            borderRadius: 12,
                            position: 'relative',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            transition: 'all 0.25s ease',
                            textDecoration: 'none',
                            background: boardBg,
                          }}
                        >
                          <div className="dp-fav-card-overlay" style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'linear-gradient(135deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.4) 100%)',
                            transition: 'all 0.3s',
                          }} />
                          <span style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            color: '#fbbf24',
                            zIndex: 2,
                          }}>
                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
                              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </span>
                          <div style={{
                            position: 'relative',
                            zIndex: 1,
                            padding: '12px 14px',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}>
                            <div style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'white',
                              textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                            }}>{board.name}</div>
                            <div style={{
                              fontSize: 11,
                              color: 'rgba(255,255,255,0.7)',
                            }}>{board.workspaceName}</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ===== WORKSPACE SECTIONS (Drag & Drop) ===== */}
              <div id="section-workspaces" style={{ scrollMarginTop: 20 }} />
              <DragDropContext onDragEnd={handleWorkspaceDragEnd}>
                <Droppable droppableId="workspaces" type="WORKSPACE">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                    >
                      {workspaces.map((workspace, index) => {
                        const allWsBoards = getBoardsForWorkspace(workspace.id);
                        const boards = filterBoards(allWsBoards);
                        const isFavorite = favoriteWorkspaces.includes(workspace.id);
                        const colorScheme = workspaceIconColors[index % workspaceIconColors.length];

                        return (
                          <Draggable
                            key={workspace.id}
                            draggableId={workspace.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  marginBottom: 36,
                                }}
                              >
                                <div style={{
                                  opacity: snapshot.isDragging ? 0.8 : 1,
                                  animation: 'dp-fadeInUp 0.4s ease-out forwards',
                                  animationDelay: `${0.15 + index * 0.05}s`,
                                }}>
                                  {/* Workspace Header */}
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 14,
                                    marginBottom: 16,
                                  }}>
                                    {/* Drag Handle */}
                                    <div
                                      {...provided.dragHandleProps}
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 2,
                                        alignItems: 'center',
                                        cursor: 'grab',
                                        padding: 4,
                                        borderRadius: 4,
                                        opacity: 0.3,
                                        transition: 'opacity 0.2s',
                                      }}
                                      title="Arrastar para reordenar"
                                    >
                                      <div style={{ display: 'flex', gap: 3 }}>
                                        <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-dimmed)' }} />
                                        <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-dimmed)' }} />
                                      </div>
                                      <div style={{ display: 'flex', gap: 3 }}>
                                        <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-dimmed)' }} />
                                        <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-dimmed)' }} />
                                      </div>
                                      <div style={{ display: 'flex', gap: 3 }}>
                                        <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-dimmed)' }} />
                                        <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-dimmed)' }} />
                                      </div>
                                    </div>

                                    {/* Workspace icon with gradient + initials */}
                                    <div style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: 10,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      background: colorScheme.bg,
                                      boxShadow: `0 4px 12px ${colorScheme.color}4D`,
                                      fontSize: 14,
                                      fontWeight: 700,
                                      color: 'white',
                                    }}>{getInitials(workspace.name)}</div>

                                    {/* Title + star + count */}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                                      {editingWorkspace?.id === workspace.id ? (
                                        <input
                                          type="text"
                                          value={editingWorkspace.name}
                                          onChange={(e) => setEditingWorkspace({ ...editingWorkspace, name: e.target.value })}
                                          onBlur={() => {
                                            if (editingWorkspace.name.trim()) {
                                              updateWorkspaceMutation.mutate({
                                                id: workspace.id,
                                                data: { name: editingWorkspace.name }
                                              });
                                            } else {
                                              setEditingWorkspace(null);
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              if (editingWorkspace.name.trim()) {
                                                updateWorkspaceMutation.mutate({
                                                  id: workspace.id,
                                                  data: { name: editingWorkspace.name }
                                                });
                                              }
                                            } else if (e.key === 'Escape') {
                                              setEditingWorkspace(null);
                                            }
                                          }}
                                          autoFocus
                                          style={{
                                            fontSize: 18,
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                            padding: '4px 8px',
                                            borderRadius: 6,
                                            background: 'transparent',
                                            border: '2px solid var(--accent)',
                                            outline: 'none',
                                            fontFamily: 'inherit',
                                          }}
                                        />
                                      ) : (
                                        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                                          {workspace.name}
                                        </span>
                                      )}
                                      <button
                                        onClick={() => toggleFavoriteWorkspace(workspace.id)}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                          color: isFavorite ? '#fbbf24' : 'var(--text-dimmed)',
                                          transition: 'all 0.2s',
                                          padding: 0,
                                          display: 'flex',
                                          alignItems: 'center',
                                        }}
                                        title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                      >
                                        <svg
                                          width="16" height="16"
                                          fill={isFavorite ? 'currentColor' : 'none'}
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                        </svg>
                                      </button>
                                    </div>

                                    {/* Board count badge */}
                                    <span style={{
                                      fontSize: 12,
                                      color: 'var(--text-dimmed)',
                                      background: 'var(--surface-subtle)',
                                      padding: '3px 10px',
                                      borderRadius: 12,
                                    }}>{allWsBoards.length} boards</span>

                                    {/* Member avatars */}
                                    <div style={{ display: 'flex', alignItems: 'center', marginLeft: 8 }}>
                                      {(() => {
                                        // Build unique members list: owner + workspace members
                                        const allMembers: { id: string; name: string; avatarUrl?: string | null }[] = [];
                                        if (workspace.owner) {
                                          allMembers.push(workspace.owner);
                                        }
                                        workspace.members?.forEach((wm: any) => {
                                          if (wm.user && !allMembers.some(m => m.id === wm.user.id)) {
                                            allMembers.push(wm.user);
                                          }
                                        });
                                        const maxShow = 4;
                                        const shown = allMembers.slice(0, maxShow);
                                        const extra = allMembers.length - maxShow;
                                        return (
                                          <>
                                            {shown.map((member, mIdx) => (
                                              member.avatarUrl ? (
                                                <img
                                                  key={member.id}
                                                  src={member.avatarUrl}
                                                  alt={member.name}
                                                  title={member.name}
                                                  style={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: '50%',
                                                    border: '2px solid var(--surface-base)',
                                                    objectFit: 'cover',
                                                    marginLeft: mIdx > 0 ? -6 : 0,
                                                    zIndex: shown.length - mIdx,
                                                    position: 'relative',
                                                  }}
                                                />
                                              ) : (
                                                <div
                                                  key={member.id}
                                                  title={member.name}
                                                  style={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: '50%',
                                                    border: '2px solid var(--surface-base)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: 9,
                                                    fontWeight: 700,
                                                    color: 'white',
                                                    background: 'var(--gradient-primary)',
                                                    marginLeft: mIdx > 0 ? -6 : 0,
                                                    zIndex: shown.length - mIdx,
                                                    position: 'relative',
                                                    flexShrink: 0,
                                                  }}
                                                >{getInitials(member.name)}</div>
                                              )
                                            ))}
                                            {extra > 0 && (
                                              <div style={{
                                                width: 24,
                                                height: 24,
                                                borderRadius: '50%',
                                                border: '2px solid var(--surface-base)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 9,
                                                fontWeight: 700,
                                                color: 'var(--text-faint)',
                                                background: 'var(--border-visible)',
                                                marginLeft: -6,
                                                position: 'relative',
                                                flexShrink: 0,
                                              }}>+{extra}</div>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>

                                    {/* Three-dot menu */}
                                    <div style={{ position: 'relative' }}>
                                      <button
                                        onClick={() => setWorkspaceMenuOpen(workspaceMenuOpen === workspace.id ? null : workspace.id)}
                                        className="dp-ws-more-btn"
                                        style={{
                                          width: 30,
                                          height: 30,
                                          borderRadius: 8,
                                          border: 'none',
                                          background: 'transparent',
                                          color: 'var(--text-dimmed)',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          transition: 'all 0.2s',
                                        }}
                                      >
                                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                        </svg>
                                      </button>
                                      {workspaceMenuOpen === workspace.id && (
                                        <>
                                          <div
                                            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                                            onClick={() => setWorkspaceMenuOpen(null)}
                                          />
                                          <div style={{
                                            position: 'absolute',
                                            right: 0,
                                            marginTop: 8,
                                            width: 192,
                                            borderRadius: 12,
                                            boxShadow: 'var(--shadow-lg)',
                                            zIndex: 20,
                                            padding: '6px 0',
                                            background: 'var(--surface-dropdown)',
                                            backdropFilter: 'blur(20px)',
                                            border: '1px solid var(--border-accent)',
                                          }}>
                                            <button
                                              onClick={() => {
                                                setEditingWorkspace({ id: workspace.id, name: workspace.name });
                                                setWorkspaceMenuOpen(null);
                                              }}
                                              style={{
                                                width: '100%',
                                                padding: '8px 16px',
                                                textAlign: 'left',
                                                fontSize: 13,
                                                color: 'var(--text-primary)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                fontFamily: 'inherit',
                                                transition: 'background 0.15s',
                                              }}
                                              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--surface-subtle)'; }}
                                              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
                                            >
                                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                              </svg>
                                              Editar nome
                                            </button>
                                            <button
                                              onClick={() => {
                                                setWorkspaceMembersModal(workspace.id);
                                                setWorkspaceMenuOpen(null);
                                              }}
                                              style={{
                                                width: '100%',
                                                padding: '8px 16px',
                                                textAlign: 'left',
                                                fontSize: 13,
                                                color: 'var(--text-primary)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                fontFamily: 'inherit',
                                                transition: 'background 0.15s',
                                              }}
                                              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--surface-subtle)'; }}
                                              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
                                            >
                                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                              </svg>
                                              Gerenciar membros
                                            </button>
                                            <button
                                              onClick={async () => {
                                                const confirmed = await confirmAction({
                                                  title: 'Deletar workspace',
                                                  message: 'Tem certeza que deseja deletar este workspace? Todos os boards serao perdidos!',
                                                  confirmText: 'Deletar',
                                                  variant: 'danger',
                                                });
                                                if (confirmed) {
                                                  deleteWorkspaceMutation.mutate(workspace.id);
                                                }
                                                setWorkspaceMenuOpen(null);
                                              }}
                                              style={{
                                                width: '100%',
                                                padding: '8px 16px',
                                                textAlign: 'left',
                                                fontSize: 13,
                                                color: '#ef4444',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                fontFamily: 'inherit',
                                                transition: 'background 0.15s',
                                              }}
                                              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; }}
                                              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
                                            >
                                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                              Deletar workspace
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Board Grid */}
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                    gap: 14,
                                  }}>
                                    {boards.map((board: any, boardIndex: number) => {
                                      const isBoardFavorite = favoriteBoards.includes(board.id);
                                      const boardBg = board.backgroundColor || boardColorClasses[boardIndex % boardColorClasses.length];

                                      return (
                                        <div key={board.id} style={{ position: 'relative', animation: 'dp-fadeInScale 0.4s ease-out forwards', animationDelay: `${boardIndex * 0.05}s` }}>
                                          <Link
                                            to={`/board/${board.id}`}
                                            className="dp-board-card"
                                            style={{
                                              display: 'block',
                                              borderRadius: 12,
                                              overflow: 'hidden',
                                              position: 'relative',
                                              cursor: 'pointer',
                                              transition: 'all 0.25s ease',
                                              textDecoration: 'none',
                                              aspectRatio: '16 / 9',
                                              minHeight: 110,
                                              background: boardBg,
                                            }}
                                          >
                                            <div className="dp-board-overlay" style={{
                                              position: 'absolute',
                                              inset: 0,
                                              background: 'linear-gradient(160deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 100%)',
                                              transition: 'all 0.3s',
                                            }} />
                                            <div style={{
                                              position: 'relative',
                                              zIndex: 1,
                                              padding: '14px 16px',
                                              height: '100%',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              justifyContent: 'space-between',
                                            }}>
                                              {/* Board card top */}
                                              <div style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                justifyContent: 'space-between',
                                              }}>
                                                <span style={{
                                                  fontSize: 14,
                                                  fontWeight: 600,
                                                  color: 'white',
                                                  textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                                                  flex: 1,
                                                }}>{board.name}</span>
                                                <button
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setBoardMenuOpen(boardMenuOpen === board.id ? null : board.id);
                                                  }}
                                                  className="dp-board-menu-btn"
                                                  style={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: 6,
                                                    border: 'none',
                                                    background: 'rgba(0,0,0,0.35)',
                                                    color: 'white',
                                                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    opacity: 0,
                                                    transition: 'all 0.2s',
                                                  }}
                                                >
                                                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                                                  </svg>
                                                </button>
                                              </div>
                                              {/* Board card bottom */}
                                              <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                              }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                  <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                    fontSize: 11,
                                                    color: 'rgba(255,255,255,0.6)',
                                                  }}>
                                                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                                    </svg>
                                                    Atualizado recentemente
                                                  </div>
                                                  {board.members && board.members.length > 0 && (
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                      {board.members.slice(0, 3).map((bm: any, mIdx: number) => (
                                                        bm.user?.avatarUrl ? (
                                                          <img
                                                            key={bm.id}
                                                            src={bm.user.avatarUrl}
                                                            alt={bm.user.name}
                                                            title={bm.user.name}
                                                            style={{
                                                              width: 20,
                                                              height: 20,
                                                              borderRadius: '50%',
                                                              border: '1.5px solid rgba(0,0,0,0.4)',
                                                              objectFit: 'cover',
                                                              marginLeft: mIdx > 0 ? -5 : 0,
                                                              zIndex: 3 - mIdx,
                                                              position: 'relative',
                                                            }}
                                                          />
                                                        ) : (
                                                          <div
                                                            key={bm.id}
                                                            title={bm.user?.name}
                                                            style={{
                                                              width: 20,
                                                              height: 20,
                                                              borderRadius: '50%',
                                                              border: '1.5px solid rgba(0,0,0,0.4)',
                                                              display: 'flex',
                                                              alignItems: 'center',
                                                              justifyContent: 'center',
                                                              fontSize: 8,
                                                              fontWeight: 700,
                                                              color: 'white',
                                                              background: 'rgba(255,255,255,0.2)',
                                                              backdropFilter: 'blur(4px)',
                                                              marginLeft: mIdx > 0 ? -5 : 0,
                                                              zIndex: 3 - mIdx,
                                                              position: 'relative',
                                                              flexShrink: 0,
                                                            }}
                                                          >{getInitials(bm.user?.name || '?')}</div>
                                                        )
                                                      ))}
                                                      {board.members.length > 3 && (
                                                        <div style={{
                                                          width: 20,
                                                          height: 20,
                                                          borderRadius: '50%',
                                                          border: '1.5px solid rgba(0,0,0,0.4)',
                                                          display: 'flex',
                                                          alignItems: 'center',
                                                          justifyContent: 'center',
                                                          fontSize: 8,
                                                          fontWeight: 700,
                                                          color: 'rgba(255,255,255,0.7)',
                                                          background: 'rgba(255,255,255,0.15)',
                                                          marginLeft: -5,
                                                          position: 'relative',
                                                          flexShrink: 0,
                                                        }}>+{board.members.length - 3}</div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                                <button
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    toggleFavoriteBoard(board.id);
                                                  }}
                                                  className="dp-board-fav-btn"
                                                  style={{
                                                    width: 26,
                                                    height: 26,
                                                    borderRadius: 6,
                                                    border: 'none',
                                                    background: 'rgba(255,255,255,0.15)',
                                                    backdropFilter: 'blur(8px)',
                                                    color: isBoardFavorite ? '#fbbf24' : 'white',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    opacity: isBoardFavorite ? 1 : 0,
                                                    transition: 'all 0.2s',
                                                  }}
                                                >
                                                  <svg
                                                    width="13" height="13"
                                                    fill={isBoardFavorite ? 'currentColor' : 'none'}
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                  >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                                  </svg>
                                                </button>
                                              </div>
                                            </div>
                                          </Link>

                                          {/* Board Menu Dropdown */}
                                          {boardMenuOpen === board.id && (
                                            <>
                                              <div
                                                style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                                                onClick={() => setBoardMenuOpen(null)}
                                              />
                                              <div style={{
                                                position: 'absolute',
                                                right: 0,
                                                top: 32,
                                                zIndex: 20,
                                                width: 192,
                                                borderRadius: 12,
                                                boxShadow: 'var(--shadow-lg)',
                                                padding: '6px 0',
                                                background: 'var(--surface-dropdown)',
                                                backdropFilter: 'blur(20px)',
                                                border: '1px solid var(--border-accent)',
                                              }}>
                                                <button
                                                  onClick={() => {
                                                    setEditingBoard({ id: board.id, name: board.name, color: board.backgroundColor || boardBg });
                                                    setBoardMenuOpen(null);
                                                  }}
                                                  style={{
                                                    width: '100%',
                                                    padding: '8px 16px',
                                                    textAlign: 'left',
                                                    fontSize: 13,
                                                    color: 'var(--text-primary)',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    fontFamily: 'inherit',
                                                    transition: 'background 0.15s',
                                                  }}
                                                  onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--surface-subtle)'; }}
                                                  onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
                                                >
                                                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                  </svg>
                                                  Editar board
                                                </button>
                                                <button
                                                  onClick={async () => {
                                                    const confirmed = await confirmAction({
                                                      title: 'Deletar board',
                                                      message: 'Tem certeza que deseja deletar este board? Esta acao nao pode ser desfeita.',
                                                      confirmText: 'Deletar',
                                                      variant: 'danger',
                                                    });
                                                    if (confirmed) {
                                                      deleteBoardMutation.mutate(board.id);
                                                    }
                                                    setBoardMenuOpen(null);
                                                  }}
                                                  style={{
                                                    width: '100%',
                                                    padding: '8px 16px',
                                                    textAlign: 'left',
                                                    fontSize: 13,
                                                    color: '#ef4444',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    fontFamily: 'inherit',
                                                    transition: 'background 0.15s',
                                                  }}
                                                  onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; }}
                                                  onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
                                                >
                                                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                  </svg>
                                                  Deletar board
                                                </button>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      );
                                    })}

                                    {/* Create Board Card */}
                                    <button
                                      onClick={() => setShowCreateBoardModal({ workspaceId: workspace.id })}
                                      className="dp-board-card-new"
                                      style={{
                                        borderRadius: 12,
                                        border: '1.5px dashed var(--border-accent-strong)',
                                        background: 'var(--surface-card-solid)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                        cursor: 'pointer',
                                        transition: 'all 0.25s ease',
                                        minHeight: 110,
                                        aspectRatio: '16 / 9',
                                        fontFamily: 'inherit',
                                      }}
                                    >
                                      <div className="dp-new-icon" style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        background: 'var(--accent-bg)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.3s',
                                      }}>
                                        <svg width="18" height="18" fill="none" stroke="var(--accent)" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                                        </svg>
                                      </div>
                                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-dimmed)' }}>Novo board</span>
                                    </button>
                                  </div>

                                  {/* Activity Feed moved to modal - triggered from sidebar */}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </>
          )}
        </div>
      </div>
    </div>

      {/* ===== CREATE WORKSPACE MODAL ===== */}
      {showModal &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--overlay-bg)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={() => setShowModal(false)}
          >
            <div
              style={{
                borderRadius: 16,
                padding: 32,
                maxWidth: 420,
                width: '100%',
                boxShadow: 'var(--modal-shadow)',
                background: 'var(--surface-dropdown)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--border-accent)',
                margin: '0 16px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Criar Workspace
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--surface-sidebar-input)',
                    color: 'var(--text-faint)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: 'var(--text-faint)',
                    marginBottom: 8,
                  }}>Nome do Workspace *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 10,
                      background: 'var(--surface-input)',
                      color: 'var(--text-primary)',
                      border: '2px solid var(--border-accent)',
                      outline: 'none',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                    placeholder="Ex: Meu Projeto"
                    required
                    autoFocus
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: 'var(--text-faint)',
                    marginBottom: 8,
                  }}>Descricao (opcional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 10,
                      background: 'var(--surface-input)',
                      color: 'var(--text-primary)',
                      border: '2px solid var(--border-accent)',
                      outline: 'none',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      resize: 'none',
                      boxSizing: 'border-box',
                    }}
                    placeholder="Descreva o proposito deste workspace..."
                    rows={3}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: 10,
                      fontWeight: 500,
                      color: 'var(--text-faint)',
                      background: 'var(--surface-sidebar-input)',
                      border: '1px solid var(--border-accent)',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      transition: 'all 0.2s',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || !name.trim()}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: 10,
                      fontWeight: 600,
                      color: 'white',
                      background: 'var(--gradient-primary)',
                      border: 'none',
                      cursor: createMutation.isPending || !name.trim() ? 'not-allowed' : 'pointer',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      opacity: createMutation.isPending || !name.trim() ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    {createMutation.isPending ? 'Criando...' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ===== CREATE BOARD MODAL ===== */}
      {showCreateBoardModal &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--overlay-bg)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={() => { setShowCreateBoardModal(null); setSelectedTemplate(null); }}
          >
            <div
              style={{
                borderRadius: 16,
                padding: 32,
                maxWidth: 480,
                width: '100%',
                boxShadow: 'var(--modal-shadow)',
                background: 'var(--surface-dropdown)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--border-accent)',
                margin: '0 16px',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Criar Board
                </h3>
                <button
                  onClick={() => { setShowCreateBoardModal(null); setSelectedTemplate(null); }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--surface-sidebar-input)',
                    color: 'var(--text-faint)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (boardName.trim() && showCreateBoardModal) {
                    createBoardMutation.mutate({
                      workspaceId: showCreateBoardModal.workspaceId,
                      name: boardName.trim(),
                      backgroundColor: boardColor,
                      templateId: selectedTemplate,
                    });
                  }
                }}
              >
                {/* Template Selection */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: 'var(--text-faint)',
                    marginBottom: 8,
                  }}>Template</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {/* Blank option */}
                    <button
                      type="button"
                      onClick={() => setSelectedTemplate(null)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 10,
                        background: !selectedTemplate ? 'var(--accent-bg-medium)' : 'var(--surface-input)',
                        border: !selectedTemplate ? '2px solid var(--accent)' : '2px solid var(--border-accent)',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 4 }}>📄</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: !selectedTemplate ? 'var(--accent)' : 'var(--text-primary)' }}>Em branco</div>
                    </button>
                    {BOARD_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setSelectedTemplate(tpl.id)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 10,
                          background: selectedTemplate === tpl.id ? 'var(--accent-bg-medium)' : 'var(--surface-input)',
                          border: selectedTemplate === tpl.id ? '2px solid var(--accent)' : '2px solid var(--border-accent)',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                        title={tpl.lists.join(' → ')}
                      >
                        <div style={{ fontSize: 20, marginBottom: 4 }}>{tpl.icon}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: selectedTemplate === tpl.id ? 'var(--accent)' : 'var(--text-primary)' }}>{tpl.name}</div>
                      </button>
                    ))}
                  </div>
                  {selectedTemplate && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--accent-bg)',
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Listas: </span>
                      {BOARD_TEMPLATES.find(t => t.id === selectedTemplate)?.lists.join(' → ')}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: 'var(--text-faint)',
                    marginBottom: 8,
                  }}>Nome do Board *</label>
                  <input
                    type="text"
                    value={boardName}
                    onChange={(e) => setBoardName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 10,
                      background: 'var(--surface-input)',
                      color: 'var(--text-primary)',
                      border: '2px solid var(--border-accent)',
                      outline: 'none',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                    placeholder="Ex: Sprint Planning"
                    required
                    autoFocus
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: 'var(--text-faint)',
                    marginBottom: 8,
                  }}>Cor do Board</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['#667eea', '#f093fb', '#ffecd2', '#a8edea', '#fa709a', '#30cfd0'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setBoardColor(color)}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          background: color,
                          border: boardColor === color ? '3px solid white' : 'none',
                          boxShadow: boardColor === color ? '0 0 0 2px var(--accent)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setShowCreateBoardModal(null); setSelectedTemplate(null); }}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: 10,
                      fontWeight: 500,
                      color: 'var(--text-faint)',
                      background: 'var(--surface-sidebar-input)',
                      border: '1px solid var(--border-accent)',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      transition: 'all 0.2s',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createBoardMutation.isPending || !boardName.trim()}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: 10,
                      fontWeight: 600,
                      color: 'white',
                      background: 'var(--gradient-primary)',
                      border: 'none',
                      cursor: createBoardMutation.isPending || !boardName.trim() ? 'not-allowed' : 'pointer',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      opacity: createBoardMutation.isPending || !boardName.trim() ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    {createBoardMutation.isPending ? 'Criando...' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ===== EDIT BOARD MODAL ===== */}
      {editingBoard &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--overlay-bg)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={() => setEditingBoard(null)}
          >
            <div
              style={{
                borderRadius: 16,
                padding: 32,
                maxWidth: 420,
                width: '100%',
                boxShadow: 'var(--modal-shadow)',
                background: 'var(--surface-dropdown)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--border-accent)',
                margin: '0 16px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Editar Board
                </h3>
                <button
                  onClick={() => setEditingBoard(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--surface-sidebar-input)',
                    color: 'var(--text-faint)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingBoard && editingBoard.name.trim()) {
                    updateBoardMutation.mutate({
                      id: editingBoard.id,
                      data: {
                        name: editingBoard.name.trim(),
                        backgroundColor: editingBoard.color,
                      },
                    });
                  }
                }}
              >
                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: 'var(--text-faint)',
                    marginBottom: 8,
                  }}>Nome do Board *</label>
                  <input
                    type="text"
                    value={editingBoard.name}
                    onChange={(e) => setEditingBoard({ ...editingBoard, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 10,
                      background: 'var(--surface-input)',
                      color: 'var(--text-primary)',
                      border: '2px solid var(--border-accent)',
                      outline: 'none',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                    required
                    autoFocus
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: 'var(--text-faint)',
                    marginBottom: 8,
                  }}>Cor do Board</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['#667eea', '#f093fb', '#ffecd2', '#a8edea', '#fa709a', '#30cfd0'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditingBoard({ ...editingBoard, color })}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          background: color,
                          border: editingBoard.color === color ? '3px solid white' : 'none',
                          boxShadow: editingBoard.color === color ? '0 0 0 2px var(--accent)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditingBoard(null)}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: 10,
                      fontWeight: 500,
                      color: 'var(--text-faint)',
                      background: 'var(--surface-sidebar-input)',
                      border: '1px solid var(--border-accent)',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      transition: 'all 0.2s',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={updateBoardMutation.isPending || !editingBoard.name.trim()}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: 10,
                      fontWeight: 600,
                      color: 'white',
                      background: 'var(--gradient-primary)',
                      border: 'none',
                      cursor: updateBoardMutation.isPending || !editingBoard.name.trim() ? 'not-allowed' : 'pointer',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      opacity: updateBoardMutation.isPending || !editingBoard.name.trim() ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    {updateBoardMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Workspace Members Modal */}
      {workspaceMembersModal && workspaces.find(w => w.id === workspaceMembersModal) && (
        <WorkspaceMembersModal
          workspace={workspaces.find(w => w.id === workspaceMembersModal)!}
          isOpen={true}
          onClose={() => setWorkspaceMembersModal(null)}
        />
      )}
      {/* Notification Toast Provider */}
      <NotificationProvider />
      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
      <WorkspaceActivityFeed
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        workspaces={workspaces.map(w => ({
          id: w.id,
          name: w.name,
          boards: (boardQueries.data?.find(d => d.workspaceId === w.id)?.boards || []).map(b => ({ id: b.id, name: b.name })),
        }))}
      />
      <ConfirmDialog />
    </>
  );
}
