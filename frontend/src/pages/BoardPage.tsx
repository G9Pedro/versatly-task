import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { boardService } from '../services/boardService';
import { listService } from '../services/listService';
import { cardService } from '../services/cardService';
import { labelService } from '../services/labelService';
import { websocketService } from '../services/websocketService';
import { useAuthStore } from '../store/authStore';
import { useConfirmModal } from '../hooks/useConfirmModal';
import CardModal from '../components/CardModal';
import ArchivedItemsModal from '../components/ArchivedItemsModal';
import BoardMembersModal from '../components/BoardMembersModal';
import MainLayout from '../components/layout/MainLayout';
import ListColumn from '../components/board/ListColumn';
import BoardStatsModal from '../components/BoardStatsModal';
import CalendarView from '../components/CalendarView';
import TableView from '../components/TableView';
import TimelineView from '../components/TimelineView';
import type { Card } from '../types';


export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const { confirm: confirmAction, ConfirmDialog } = useConfirmModal();


  const [viewMode, setViewMode] = useState<'board' | 'calendar' | 'table' | 'timeline'>('board');
  const [showNewList, setShowNewList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [showNewCard, setShowNewCard] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [cardMenuOpen, setCardMenuOpen] = useState<{ card: Card; x: number; y: number } | null>(null);
  const [listMenuOpen, setListMenuOpen] = useState<{ list: any; x: number; y: number } | null>(null);
  const [editingListColor, setEditingListColor] = useState<any | null>(null);
  const [editingCardTitle, setEditingCardTitle] = useState<{ cardId: string; title: string } | null>(null);
  const [cardDateDropdownOpen, setCardDateDropdownOpen] = useState<Card | null>(null);
  const [cardCoverDropdownOpen, setCardCoverDropdownOpen] = useState<Card | null>(null);
  const [cardMembersDropdownOpen, setCardMembersDropdownOpen] = useState<Card | null>(null);
  const [cardLabelsDropdownOpen, setCardLabelsDropdownOpen] = useState<Card | null>(null);
  const [dateInputValue, setDateInputValue] = useState('');
  const [customColor, setCustomColor] = useState('#667eea');
  const [savedColors, setSavedColors] = useState<string[]>(() => {
    const saved = localStorage.getItem('savedListColors');
    return saved ? JSON.parse(saved) : [];
  });
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [backgroundType, setBackgroundType] = useState<'color' | 'image'>('color');
  const [customBoardColor, setCustomBoardColor] = useState('#0079bf');
  const [highlightedCards, setHighlightedCards] = useState<Set<string>>(new Set());

  // Filter state
  const [filterLabel, setFilterLabel] = useState<string>('');
  const [filterMember, setFilterMember] = useState<string>('');
  const [filterDueDate, setFilterDueDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Keyboard shortcuts state
  const [showShortcuts, setShowShortcuts] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Track local actions to prevent duplicate updates from WebSocket
  const localActionInProgress = useRef(false);

  const { data: boardData, isLoading } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => boardService.getBoard(boardId!),
    enabled: !!boardId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity, // Never mark as stale
    gcTime: Infinity, // Never garbage collect
  });

  // Abrir modal do card automaticamente se vindo de uma notificação
  useEffect(() => {
    const cardId = searchParams.get('card');
    if (cardId && boardData?.board.lists) {
      // Buscar o card nas listas
      for (const list of boardData.board.lists) {
        const card = list.cards?.find((c: Card) => c.id === cardId);
        if (card) {
          setSelectedCard(card);
          // Remover o parâmetro da URL
          setSearchParams({});
          break;
        }
      }
    }
  }, [searchParams, boardData, setSearchParams]);

  // WebSocket - Real-time updates
  useEffect(() => {
    if (!boardId || !token) return;

    // Connect to WebSocket
    websocketService.connect(token);

    // Join this board's room
    websocketService.joinBoard(boardId);

    // Helper to highlight a card temporarily
    const highlightCard = (cardId: string) => {
      setHighlightedCards(prev => new Set(prev).add(cardId));
      setTimeout(() => {
        setHighlightedCards(prev => {
          const next = new Set(prev);
          next.delete(cardId);
          return next;
        });
      }, 2000); // Remove highlight after 2 seconds
    };

    // Listen for card moved events
    const handleCardMoved = (movedCard: any) => {
      console.log('🔄 Card moved via WebSocket:', movedCard);

      // Ignore if local action is in progress
      if (localActionInProgress.current) {
        console.log('⏭️ Ignoring WebSocket event (local action in progress)');
        return;
      }

      // Highlight the moved card
      if (movedCard?.id) {
        highlightCard(movedCard.id);
      }

      // Invalidate queries to refresh the board
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    };

    // Listen for other events
    const handleCardCreated = (newCard: any) => {
      if (localActionInProgress.current) {
        return;
      }
      if (newCard?.id) {
        highlightCard(newCard.id);
      }
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    };

    const handleCardUpdated = (updatedCard: any) => {
      if (localActionInProgress.current) {
        return;
      }
      if (updatedCard?.id) {
        highlightCard(updatedCard.id);
      }
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    };

    const handleCardDeleted = () => {
      if (localActionInProgress.current) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    };

    const handleListCreated = () => {
      if (localActionInProgress.current) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    };

    const handleListUpdated = () => {
      if (localActionInProgress.current) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    };

    // Register listeners
    websocketService.onBoardEvent('card:moved', handleCardMoved);
    websocketService.onBoardEvent('card:created', handleCardCreated);
    websocketService.onBoardEvent('card:updated', handleCardUpdated);
    websocketService.onBoardEvent('card:deleted', handleCardDeleted);
    websocketService.onBoardEvent('list:created', handleListCreated);
    websocketService.onBoardEvent('list:updated', handleListUpdated);

    // Cleanup on unmount
    return () => {
      websocketService.offBoardEvent('card:moved', handleCardMoved);
      websocketService.offBoardEvent('card:created', handleCardCreated);
      websocketService.offBoardEvent('card:updated', handleCardUpdated);
      websocketService.offBoardEvent('card:deleted', handleCardDeleted);
      websocketService.offBoardEvent('list:created', handleListCreated);
      websocketService.offBoardEvent('list:updated', handleListUpdated);
      websocketService.leaveBoard(boardId);
    };
  }, [boardId, token, queryClient]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const isInInput = tag === 'INPUT' || tag === 'TEXTAREA';
      const isInDialog = !!document.activeElement?.closest('[role="dialog"]');

      // Escape always works (to close things)
      if (e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        if (cardMenuOpen) {
          setCardMenuOpen(null);
          return;
        }
        if (listMenuOpen) {
          setListMenuOpen(null);
          return;
        }
        if (editingListColor) {
          setEditingListColor(null);
          return;
        }
        if (searchTerm) {
          setSearchTerm('');
          searchInputRef.current?.blur();
          return;
        }
        return;
      }

      // Don't trigger shortcuts when typing in inputs or inside dialogs
      if (isInInput || isInDialog) return;

      // Don't trigger if any modal is open
      if (selectedCard || editingCardTitle || showBackgroundModal || showArchivedModal || showMembersModal || cardMenuOpen || listMenuOpen || editingListColor || cardDateDropdownOpen || cardCoverDropdownOpen || cardMembersDropdownOpen || cardLabelsDropdownOpen) return;

      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }

      if (e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      const keyLower = e.key.toLowerCase();

      if (keyLower === 'n' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        // Focus the add card button of the first list
        const currentLists = boardData?.board?.lists || [];
        if (currentLists.length > 0) {
          const firstListId = currentLists[0].id;
          if (showNewCard === firstListId) {
            // Already showing, close it
            setShowNewCard(null);
            setNewCardTitle('');
          } else {
            setShowNewCard(firstListId);
          }
        }
        return;
      }

      if (keyLower === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowFilters(prev => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showShortcuts, cardMenuOpen, listMenuOpen, editingListColor, searchTerm, selectedCard, editingCardTitle, showBackgroundModal, showArchivedModal, showMembersModal, cardDateDropdownOpen, cardCoverDropdownOpen, cardMembersDropdownOpen, cardLabelsDropdownOpen, showNewCard, boardData]);

  const createListMutation = useMutation({
    mutationFn: (data: { boardId: string; title: string; position: number }) =>
      listService.createList(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      setShowNewList(false);
      setNewListTitle('');
    },
  });

  const createCardMutation = useMutation({
    mutationFn: (data: {
      listId: string;
      title: string;
      position: number;
    }) => cardService.createCard(data),
    onMutate: () => {
      localActionInProgress.current = true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      setShowNewCard(null);
      setNewCardTitle('');
    },
    onSettled: () => {
      setTimeout(() => {
        localActionInProgress.current = false;
      }, 500);
    },
  });

  const moveCardMutation = useMutation({
    mutationFn: (data: { cardId: string; listId: string; position: number }) =>
      cardService.moveCard(data.cardId, { listId: data.listId, position: data.position }),
    onMutate: () => {
      localActionInProgress.current = true;
      // Save previous state for rollback
      return { previousBoard: queryClient.getQueryData(['board', boardId]) };
    },
    onError: (_err, _vars, context) => {
      // Rollback to previous state on error
      if (context?.previousBoard) {
        queryClient.setQueryData(['board', boardId], context.previousBoard);
      }
    },
    onSettled: () => {
      setTimeout(() => {
        localActionInProgress.current = false;
      }, 500);
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: (cardId: string) => cardService.deleteCard(cardId),
    onMutate: () => {
      localActionInProgress.current = true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      setCardMenuOpen(null);
    },
    onSettled: () => {
      setTimeout(() => {
        localActionInProgress.current = false;
      }, 500);
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: (data: { cardId: string; updates: Partial<Card> }) =>
      cardService.updateCard(data.cardId, data.updates),
    onMutate: () => {
      localActionInProgress.current = true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      setCardMenuOpen(null);
      setEditingCardTitle(null);
      setCardDateDropdownOpen(null);
      setCardCoverDropdownOpen(null);
      setCardMembersDropdownOpen(null);
      setCardLabelsDropdownOpen(null);
    },
    onSettled: () => {
      setTimeout(() => {
        localActionInProgress.current = false;
      }, 500);
    },
  });

  const duplicateCardMutation = useMutation({
    mutationFn: (cardId: string) => cardService.duplicateCard(cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      setCardMenuOpen(null);
    },
  });

  const archiveCardMutation = useMutation({
    mutationFn: (cardId: string) => cardService.archiveCard(cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      setCardMenuOpen(null);
    },
  });

  const addCardMemberMutation = useMutation({
    mutationFn: (data: { cardId: string; userId: string }) =>
      cardService.addMember(data.cardId, data.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });

  const removeCardMemberMutation = useMutation({
    mutationFn: (data: { cardId: string; userId: string }) =>
      cardService.removeMember(data.cardId, data.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });

  const addCardLabelMutation = useMutation({
    mutationFn: (data: { cardId: string; labelId: string }) =>
      labelService.addLabelToCard(data.labelId, data.cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });

  const removeCardLabelMutation = useMutation({
    mutationFn: (data: { cardId: string; labelId: string }) =>
      labelService.removeLabelFromCard(data.labelId, data.cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: (listId: string) => listService.deleteList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      setListMenuOpen(null);
    },
  });

  const updateListMutation = useMutation({
    mutationFn: (data: { listId: string; updates: any }) =>
      listService.updateList(data.listId, data.updates),
    onMutate: async ({ listId, updates }) => {
      // Cancela queries em andamento
      await queryClient.cancelQueries({ queryKey: ['board', boardId] });

      // Snapshot do valor anterior
      const previousBoard = queryClient.getQueryData(['board', boardId]);

      // Atualiza otimisticamente
      queryClient.setQueryData(['board', boardId], (old: any) => {
        if (!old?.board?.lists) return old;

        const newLists = old.board.lists.map((list: any) =>
          list.id === listId ? { ...list, ...updates } : list
        );

        return { ...old, board: { ...old.board, lists: newLists } };
      });

      return { previousBoard };
    },
    onError: (_err, _variables, context) => {
      // Reverte em caso de erro
      if (context?.previousBoard) {
        queryClient.setQueryData(['board', boardId], context.previousBoard);
      }
    },
    onSettled: () => {
      // Fecha os modais após a operação (sucesso ou erro)
      setListMenuOpen(null);
      setEditingListColor(null);
    },
  });

  const updateBoardMutation = useMutation({
    mutationFn: (data: { backgroundColor?: string; backgroundImageUrl?: string }) =>
      boardService.updateBoard(boardId!, data),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['board', boardId] });
      const previousBoard = queryClient.getQueryData(['board', boardId]);

      queryClient.setQueryData(['board', boardId], (old: any) => {
        if (!old?.board) return old;
        return { ...old, board: { ...old.board, ...updates } };
      });

      return { previousBoard };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(['board', boardId], context.previousBoard);
      }
    },
    onSettled: () => {
      setShowBackgroundModal(false);
    },
  });

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (newListTitle.trim() && boardId) {
      const position = board?.lists?.length || 0;
      createListMutation.mutate({
        boardId,
        title: newListTitle,
        position,
      });
    }
  };

  const handleCreateCard = (listId: string) => {
    if (newCardTitle.trim()) {
      const list = board?.lists?.find((l) => l.id === listId);
      const position = list?.cards?.length || 0;
      createCardMutation.mutate({
        listId,
        title: newCardTitle,
        position,
      });
    }
  };

  const handleDragStart = (result: any) => {
    if (result.type === 'CARD') {
      setDraggingCardId(result.draggableId);
    }
  };

  const reorderListsMutation = useMutation({
    mutationFn: (lists: Array<{ id: string; position: number }>) =>
      listService.reorderLists(lists),
    onMutate: () => {
      localActionInProgress.current = true;
      return { previousBoard: queryClient.getQueryData(['board', boardId]) };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(['board', boardId], context.previousBoard);
      }
    },
    onSettled: () => {
      setTimeout(() => {
        localActionInProgress.current = false;
      }, 500);
    },
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    // Limpa o estado de dragging
    setDraggingCardId(null);

    // Dropped outside
    if (!destination) return;

    // Dropped in the same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    // === LIST REORDER ===
    if (type === 'LIST') {
      queryClient.setQueryData(['board', boardId], (old: any) => {
        if (!old?.board?.lists) return old;
        const newLists = [...old.board.lists];
        const [movedList] = newLists.splice(source.index, 1);
        newLists.splice(destination.index, 0, movedList);
        return { ...old, board: { ...old.board, lists: newLists } };
      });

      // Build reorder payload
      const currentLists = (queryClient.getQueryData(['board', boardId]) as any)?.board?.lists || [];
      const reorderPayload = currentLists.map((list: any, index: number) => ({
        id: list.id,
        position: index,
      }));
      reorderListsMutation.mutate(reorderPayload);
      return;
    }

    // === CARD MOVE ===
    queryClient.setQueryData(['board', boardId], (old: any) => {
      if (!old?.board?.lists) return old;

      const movedCard = old.board.lists
        .flatMap((l: any) => l.cards || [])
        .find((c: any) => c.id === draggableId);

      if (!movedCard) return old;

      const newLists = old.board.lists.map((list: any) => {
        let cards = (list.cards || []).filter((c: any) => c.id !== draggableId);
        if (list.id === destination.droppableId) {
          cards = [...cards];
          cards.splice(destination.index, 0, { ...movedCard, listId: destination.droppableId });
        }
        return { ...list, cards };
      });

      return { ...old, board: { ...old.board, lists: newLists } };
    });

    moveCardMutation.mutate({
      cardId: draggableId,
      listId: destination.droppableId,
      position: destination.index,
    });
  };

  const handleListMenuClick = (e: React.MouseEvent, list: any) => {
    e.stopPropagation();
    setListMenuOpen({ list, x: e.clientX, y: e.clientY });
  };

  const handleCardContextMenu = (e: React.MouseEvent, card: Card) => {
    e.stopPropagation();
    const menuHeight = 400; // approximate menu height
    const menuWidth = 220;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    let x = e.clientX;
    let y = e.clientY;
    if (y + menuHeight > viewportH) {
      y = Math.max(8, viewportH - menuHeight);
    }
    if (x + menuWidth > viewportW) {
      x = Math.max(8, viewportW - menuWidth);
    }
    setCardMenuOpen({ card, x, y });
  };

  const handleDeleteCard = async (cardId: string) => {
    const confirmed = await confirmAction({
      title: 'Deletar card',
      message: 'Tem certeza que deseja deletar este card? Esta acao nao pode ser desfeita.',
      confirmText: 'Deletar',
      variant: 'danger',
    });
    if (confirmed) {
      deleteCardMutation.mutate(cardId);
    }
  };

  const handleStartEditingCardTitle = (card: Card) => {
    setEditingCardTitle({ cardId: card.id, title: card.title });
    setCardMenuOpen(null);
  };

  const handleSaveCardTitle = () => {
    if (editingCardTitle && editingCardTitle.title.trim()) {
      updateCardMutation.mutate({
        cardId: editingCardTitle.cardId,
        updates: { title: editingCardTitle.title },
      });
    }
  };

  const handleDuplicateCard = (cardId: string) => {
    duplicateCardMutation.mutate(cardId);
  };

  const handleArchiveCard = (cardId: string) => {
    archiveCardMutation.mutate(cardId);
  };

  const formatDateToBR = (isoDate: string | null): string => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateToISO = (brDate: string): string | null => {
    const cleaned = brDate.replace(/\D/g, '');
    if (cleaned.length !== 8) return null;

    const day = cleaned.substring(0, 2);
    const month = cleaned.substring(2, 4);
    const year = cleaned.substring(4, 8);

    const dayNum = parseInt(day);
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900) {
      return null;
    }

    // Criar um Date object e converter para ISO string
    const date = new Date(yearNum, monthNum - 1, dayNum, 12, 0, 0, 0);
    return date.toISOString();
  };

  const applyDateMask = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    let masked = cleaned;

    if (cleaned.length >= 2) {
      masked = cleaned.substring(0, 2) + '/' + cleaned.substring(2);
    }
    if (cleaned.length >= 4) {
      masked = cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4) + '/' + cleaned.substring(4, 8);
    }

    return masked;
  };

  const handleOpenCardDateDropdown = (card: Card) => {
    setCardDateDropdownOpen(card);
    setDateInputValue(formatDateToBR(card.dueDate || null));
    setCardMenuOpen(null);
  };

  const handleOpenCardCoverDropdown = (card: Card) => {
    setCardCoverDropdownOpen(card);
    setCardMenuOpen(null);
  };

  const handleOpenCardMembersDropdown = (card: Card) => {
    setCardMembersDropdownOpen(card);
    setCardMenuOpen(null);
  };

  const handleOpenCardLabelsDropdown = (card: Card) => {
    setCardLabelsDropdownOpen(card);
    setCardMenuOpen(null);
  };

  const handleDeleteList = async (listId: string) => {
    const confirmed = await confirmAction({
      title: 'Deletar lista',
      message: 'Tem certeza que deseja deletar esta lista? Todos os cards serao removidos.',
      confirmText: 'Deletar',
      variant: 'danger',
    });
    if (confirmed) {
      deleteListMutation.mutate(listId);
    }
  };

  const handleChangeListColor = (list: any, color: string) => {
    updateListMutation.mutate({
      listId: list.id,
      updates: { backgroundColor: color },
    });
  };

  const handleRenameList = (listId: string, newTitle: string) => {
    updateListMutation.mutate({
      listId,
      updates: { title: newTitle },
    });
  };

  const handleSaveCustomColor = () => {
    const gradient = `linear-gradient(135deg, ${customColor} 0%, ${customColor} 100%)`;
    if (!savedColors.includes(gradient)) {
      const newSavedColors = [...savedColors, gradient];
      setSavedColors(newSavedColors);
      localStorage.setItem('savedListColors', JSON.stringify(newSavedColors));
    }
    handleChangeListColor(editingListColor, gradient);
  };

  const handleRemoveSavedColor = (colorToRemove: string) => {
    const newSavedColors = savedColors.filter(c => c !== colorToRemove);
    setSavedColors(newSavedColors);
    localStorage.setItem('savedListColors', JSON.stringify(newSavedColors));
  };

  const handleApplyBackgroundColor = (color: string) => {
    updateBoardMutation.mutate({ backgroundColor: color, backgroundImageUrl: null as any });
  };

  const handleApplyBackgroundImage = (imageUrl: string) => {
    updateBoardMutation.mutate({ backgroundColor: null as any, backgroundImageUrl: imageUrl });
  };

  const board = boardData?.board;
  const lists = board?.lists || [];

  // Filter logic
  const hasActiveFilters = filterLabel !== '' || filterMember !== '' || filterDueDate !== '';

  const filterCards = useCallback((cards: Card[]) => {
    if (!hasActiveFilters) return cards;
    return cards.filter(card => {
      // Label filter
      if (filterLabel && !card.labels?.some(cl => cl.label.id === filterLabel)) return false;

      // Member filter
      if (filterMember && !card.members?.some(cm => cm.user.id === filterMember)) return false;

      // Due date filter
      if (filterDueDate) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        if (filterDueDate === 'overdue') {
          if (!card.dueDate || new Date(card.dueDate) >= now) return false;
        } else if (filterDueDate === 'today') {
          if (!card.dueDate) return false;
          const due = new Date(card.dueDate);
          if (due < today || due >= new Date(today.getTime() + 24 * 60 * 60 * 1000)) return false;
        } else if (filterDueDate === 'week') {
          if (!card.dueDate) return false;
          const due = new Date(card.dueDate);
          if (due < today || due > weekFromNow) return false;
        } else if (filterDueDate === 'none') {
          if (card.dueDate) return false;
        }
      }

      return true;
    });
  }, [filterLabel, filterMember, filterDueDate, hasActiveFilters]);

  // Compute filtered lists (cards filtered before passing to ListColumn)
  const filteredLists = useMemo(() => {
    if (!hasActiveFilters) return lists;
    return lists.map((list: any) => ({
      ...list,
      cards: filterCards(list.cards || []),
    }));
  }, [lists, filterCards, hasActiveFilters]);

  // Card count stats for filter badge
  const filterStats = useMemo(() => {
    if (!hasActiveFilters) return null;
    const totalCards = lists.reduce((sum: number, list: any) => sum + (list.cards?.length || 0), 0);
    const visibleCards = filteredLists.reduce((sum: number, list: any) => sum + (list.cards?.length || 0), 0);
    return { total: totalCards, visible: visibleCards };
  }, [lists, filteredLists, hasActiveFilters]);

  const clearAllFilters = useCallback(() => {
    setFilterLabel('');
    setFilterMember('');
    setFilterDueDate('');
  }, []);

  if (isLoading) {
    return (
      <MainLayout>
        <div
          className="flex flex-col h-full"
          style={{ background: 'var(--surface-board)' }}
        >
          {/* Skeleton Board Header */}
          <div
            className="rounded-[14px]"
            style={{
              margin: '12px 16px 0',
              background: 'var(--surface-board-header)',
              border: '1px solid var(--border-default)',
              padding: '10px 16px',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-[34px] h-[34px] rounded-[9px] animate-pulse" style={{ background: 'var(--border-default)' }} />
              <div style={{ width: '1px', height: '24px', background: 'var(--border-visible)' }} />
              <div className="flex-1">
                <div className="h-4 w-40 rounded animate-pulse" style={{ background: 'var(--border-visible)' }} />
                <div className="h-3 w-24 rounded animate-pulse mt-1" style={{ background: 'var(--surface-subtle)' }} />
              </div>
              <div className="flex gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-lg animate-pulse" style={{ background: 'var(--border-default)' }} />
                ))}
              </div>
            </div>
          </div>

          {/* Skeleton Lists */}
          <div className="flex-1 flex gap-[14px] overflow-hidden" style={{ padding: '16px 16px 12px' }}>
            {[3, 4, 2].map((cardCount, listIdx) => (
              <div
                key={listIdx}
                className="flex-shrink-0 w-[280px] rounded-[14px]"
                style={{
                  background: 'var(--surface-overlay)',
                  border: '1px solid var(--border-default)',
                  padding: '14px',
                }}
              >
                {/* List title skeleton */}
                <div className="h-4 rounded animate-pulse mb-4" style={{ background: 'var(--border-visible)', width: `${60 + listIdx * 15}%` }} />
                {/* Card skeletons */}
                <div className="flex flex-col gap-2">
                  {Array.from({ length: cardCount }).map((_, cardIdx) => (
                    <div
                      key={cardIdx}
                      className="rounded-[10px] animate-pulse"
                      style={{
                        background: 'var(--surface-card)',
                        border: '1px solid var(--border-subtle)',
                        padding: '10px 12px',
                      }}
                    >
                      {cardIdx === 0 && listIdx === 1 && (
                        <div className="h-20 rounded-lg mb-2" style={{ background: 'var(--surface-subtle)', margin: '-10px -12px 8px -12px', borderRadius: '10px 10px 0 0' }} />
                      )}
                      <div className="flex items-center gap-2">
                        <div className="w-[18px] h-[18px] rounded-full flex-shrink-0" style={{ border: '2px solid var(--border-visible)' }} />
                        <div className="h-3 rounded flex-1" style={{ background: 'var(--border-visible)', width: `${50 + cardIdx * 10}%` }} />
                      </div>
                      {cardIdx % 2 === 0 && (
                        <div className="flex gap-1 mt-2">
                          <div className="h-2 w-10 rounded" style={{ background: 'var(--accent-bg-medium)' }} />
                          <div className="h-2 w-8 rounded" style={{ background: 'var(--accent-bg-medium)' }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!board) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: 'var(--gradient-primary)',
        }}
      >
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Board não encontrado
          </h2>
          <Link
            to="/dashboard"
            className="font-medium"
            style={{ color: 'var(--accent)' }}
          >
            Voltar para Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const getBoardBackground = () => {
    if (board?.backgroundImageUrl) {
      return {
        backgroundImage: `url(${board.backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }
    if (board?.backgroundColor && board.backgroundColor !== '#667eea') {
      return { background: board.backgroundColor };
    }
    return { background: 'var(--surface-board)' };
  };

  return (
    <MainLayout>
      <div
        className="flex flex-col h-full relative"
        // Board area padding handled by children
        style={getBoardBackground()}
      >
        {/* Overlay para melhorar legibilidade quando há imagem de fundo */}
        {board?.backgroundImageUrl && (
          <div
            className="absolute inset-0 bg-black/20"
            style={{ zIndex: 0 }}
          />
        )}
        {/* Board Header */}
        <div
          className="rounded-[14px] shadow-lg relative z-10"
          // Board header - mockup dimensions
          // margin applied via style for precise control
          style={{
            margin: '12px 16px 0',
            background: 'var(--surface-board-header)',
            backdropFilter: 'blur(24px)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div className="flex items-center gap-3" style={{ padding: '10px 16px' }}>
            <Link
              to="/dashboard"
              className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center transition-all hover:translate-x-[-2px] flex-shrink-0"
              style={{
                background: 'var(--border-default)',
                color: 'var(--text-secondary)',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>

            {/* Divider */}
            <div className="flex-shrink-0" style={{ width: '1px', height: '24px', background: 'var(--border-visible)' }} />

            <div className="flex-1 min-w-0">
              <h1
                className="text-[16px] font-bold leading-tight truncate"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.3px' }}
              >
                {board.name}
              </h1>
              {board.description && (
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--text-disabled)' }}
                >
                  {board.description}
                </span>
              )}
            </div>

            {/* Search Bar */}
            <div className="flex-shrink-0" style={{ width: '220px' }}>
              <div
                className="flex items-center gap-2 transition-all focus-within:w-[260px]"
                style={{
                  padding: '7px 12px',
                  borderRadius: '9px',
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: 'var(--text-dimmed)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar cards..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-xs"
                  style={{ color: 'var(--text-primary)' }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="flex-shrink-0"
                    style={{ color: 'var(--text-dimmed)' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Member Avatars */}
            {board?.members && board.members.length > 0 && (
              <div className="flex items-center flex-shrink-0">
                {board.members.slice(0, 3).map((member: any, idx: number) => {
                  const gradients = [
                    'linear-gradient(135deg, #667eea, #764ba2)',
                    'linear-gradient(135deg, #f093fb, #f5576c)',
                    'linear-gradient(135deg, #0093E9, #80D0C7)',
                  ];
                  return (
                    <div
                      key={member.id || idx}
                      className="flex items-center justify-center text-white cursor-pointer transition-all hover:-translate-y-0.5"
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: gradients[idx % gradients.length],
                        border: '2px solid var(--surface-board-header)',
                        marginLeft: idx === 0 ? '0' : '-6px',
                        fontSize: '10px',
                        fontWeight: 700,
                        zIndex: 3 - idx,
                      }}
                      title={member.user?.name || member.name}
                    >
                      {(member.user?.name || member.name || '?').charAt(0).toUpperCase()}
                      {(member.user?.name || member.name || '?').split(' ')[1]?.charAt(0)?.toUpperCase() || ''}
                    </div>
                  );
                })}
                {board.members.length > 3 && (
                  <div
                    className="flex items-center justify-center text-white cursor-pointer"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'var(--border-visible)',
                      border: '2px solid var(--surface-board-header)',
                      marginLeft: '-6px',
                      fontSize: '10px',
                      fontWeight: 700,
                    }}
                  >
                    +{board.members.length - 3}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 flex-shrink-0">
            {/* View Mode Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                borderRadius: '9px',
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border-default)',
                padding: '2px',
                gap: '2px',
              }}
            >
              <button
                onClick={() => setViewMode('board')}
                title="Visão Board"
                style={{
                  padding: '5px 10px',
                  borderRadius: '7px',
                  background: viewMode === 'board' ? 'var(--accent-bg-medium)' : 'transparent',
                  color: viewMode === 'board' ? 'var(--accent)' : 'var(--text-dimmed)',
                  border: viewMode === 'board' ? '1px solid var(--border-accent)' : '1px solid transparent',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s',
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Board
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                title="Visão Calendário"
                style={{
                  padding: '5px 10px',
                  borderRadius: '7px',
                  background: viewMode === 'calendar' ? 'var(--accent-bg-medium)' : 'transparent',
                  color: viewMode === 'calendar' ? 'var(--accent)' : 'var(--text-dimmed)',
                  border: viewMode === 'calendar' ? '1px solid var(--border-accent)' : '1px solid transparent',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s',
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Calendário
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Visão Tabela"
                style={{
                  padding: '5px 10px',
                  borderRadius: '7px',
                  background: viewMode === 'table' ? 'var(--accent-bg-medium)' : 'transparent',
                  color: viewMode === 'table' ? 'var(--accent)' : 'var(--text-dimmed)',
                  border: viewMode === 'table' ? '1px solid var(--border-accent)' : '1px solid transparent',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s',
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
                </svg>
                Tabela
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                title="Visão Timeline"
                style={{
                  padding: '5px 10px',
                  borderRadius: '7px',
                  background: viewMode === 'timeline' ? 'var(--accent-bg-medium)' : 'transparent',
                  color: viewMode === 'timeline' ? 'var(--accent)' : 'var(--text-dimmed)',
                  border: viewMode === 'timeline' ? '1px solid var(--border-accent)' : '1px solid transparent',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s',
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Timeline
              </button>
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '20px', background: 'var(--border-visible)' }} />

            <button
              onClick={() => setShowMembersModal(true)}
              className="flex items-center gap-1.5 transition-all hover:scale-105"
              style={{
                padding: '7px 14px',
                borderRadius: '9px',
                background: 'var(--border-default)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Membros
            </button>

            <button
              onClick={() => setShowBackgroundModal(true)}
              className="flex items-center gap-1.5 transition-all hover:scale-105"
              style={{
                padding: '7px 14px',
                borderRadius: '9px',
                background: 'var(--border-default)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Fundo
            </button>

            <button
              onClick={() => setShowArchivedModal(true)}
              className="flex items-center gap-1.5 transition-all hover:scale-105"
              style={{
                padding: '7px 14px',
                borderRadius: '9px',
                background: 'var(--border-default)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Arquivados
            </button>

            <button
              onClick={() => setShowStatsModal(true)}
              className="flex items-center gap-1.5 transition-all hover:scale-105"
              style={{
                padding: '7px 14px',
                borderRadius: '9px',
                background: 'var(--border-default)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Estatísticas
            </button>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          className="relative z-10"
          style={{
            margin: '0 16px',
          }}
        >
          <div
            className="flex items-center gap-3"
            style={{
              padding: '8px 0',
            }}
          >
            {/* Filtros Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 transition-all hover:scale-105"
              style={{
                padding: '6px 14px',
                borderRadius: '9px',
                background: showFilters ? 'var(--accent-bg-medium)' : 'var(--border-default)',
                color: showFilters ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 500,
                border: showFilters ? '1px solid var(--border-accent-strong)' : '1px solid var(--border-default)',
                position: 'relative',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtros
              {hasActiveFilters && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    boxShadow: 'var(--shadow-glow)',
                  }}
                />
              )}
            </button>

            {/* Filter Stats Badge */}
            {hasActiveFilters && filterStats && (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-faint)',
                  fontWeight: 500,
                }}
              >
                Mostrando {filterStats.visible} de {filterStats.total} cards
              </span>
            )}
          </div>

          {/* Expanded Filter Dropdowns */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  className="flex items-center gap-3 flex-wrap"
                  style={{
                    padding: '8px 0 10px',
                  }}
                >
                  {/* Label Filter */}
                  <div className="flex flex-col gap-1">
                    <label style={{ fontSize: '10px', color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Etiqueta
                    </label>
                    <select
                      value={filterLabel}
                      onChange={(e) => setFilterLabel(e.target.value)}
                      style={{
                        padding: '6px 28px 6px 10px',
                        borderRadius: '8px',
                        background: 'var(--surface-input)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        border: filterLabel ? '1px solid var(--border-focus)' : '1px solid var(--border-accent-medium)',
                        outline: 'none',
                        cursor: 'pointer',
                        minWidth: '150px',
                        appearance: 'none' as const,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b8fa3' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 8px center',
                      }}
                    >
                      <option value="">Todas</option>
                      {board?.labels?.map((label: any) => (
                        <option key={label.id} value={label.id}>
                          {label.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Member Filter */}
                  <div className="flex flex-col gap-1">
                    <label style={{ fontSize: '10px', color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Membro
                    </label>
                    <select
                      value={filterMember}
                      onChange={(e) => setFilterMember(e.target.value)}
                      style={{
                        padding: '6px 28px 6px 10px',
                        borderRadius: '8px',
                        background: 'var(--surface-input)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        border: filterMember ? '1px solid var(--border-focus)' : '1px solid var(--border-accent-medium)',
                        outline: 'none',
                        cursor: 'pointer',
                        minWidth: '150px',
                        appearance: 'none' as const,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b8fa3' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 8px center',
                      }}
                    >
                      <option value="">Todos</option>
                      {board?.members?.map((member: any) => (
                        <option key={member.user.id} value={member.user.id}>
                          {member.user.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Due Date Filter */}
                  <div className="flex flex-col gap-1">
                    <label style={{ fontSize: '10px', color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Data de entrega
                    </label>
                    <select
                      value={filterDueDate}
                      onChange={(e) => setFilterDueDate(e.target.value)}
                      style={{
                        padding: '6px 28px 6px 10px',
                        borderRadius: '8px',
                        background: 'var(--surface-input)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        border: filterDueDate ? '1px solid var(--border-focus)' : '1px solid var(--border-accent-medium)',
                        outline: 'none',
                        cursor: 'pointer',
                        minWidth: '150px',
                        appearance: 'none' as const,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b8fa3' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 8px center',
                      }}
                    >
                      <option value="">Todas</option>
                      <option value="overdue">Vencidas</option>
                      <option value="today">Hoje</option>
                      <option value="week">Esta semana</option>
                      <option value="none">Sem prazo</option>
                    </select>
                  </div>

                  {/* Clear Filters Button */}
                  {hasActiveFilters && (
                    <div className="flex flex-col gap-1">
                      <label style={{ fontSize: '10px', color: 'transparent', fontWeight: 600 }}>
                        &nbsp;
                      </label>
                      <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-1.5 transition-all hover:scale-105"
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          fontSize: '12px',
                          fontWeight: 500,
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                        }}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Limpar filtros
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Board Content */}
        {viewMode === 'calendar' ? (
          <div className="flex-1 overflow-auto relative z-10">
            <CalendarView
              board={board}
              onCardClick={setSelectedCard}
            />
          </div>
        ) : viewMode === 'table' ? (
          <div className="flex-1 overflow-auto relative z-10">
            <TableView
              board={board}
              onCardClick={(card) => setSelectedCard(card)}
            />
          </div>
        ) : viewMode === 'timeline' ? (
          <div className="flex-1 overflow-auto relative z-10">
            <TimelineView
              board={board}
              onCardClick={(card) => setSelectedCard(card)}
            />
          </div>
        ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden relative z-10" style={{ padding: '0 16px 12px' }}>
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <Droppable droppableId="board-lists" type="LIST" direction="horizontal">
            {(boardProvided) => (
              <div
                ref={boardProvided.innerRef}
                {...boardProvided.droppableProps}
                className="flex h-full items-start"
                style={{ gap: '14px' }}
              >
            {/* Lists */}
            {filteredLists.map((list, listIndex) => (
              <Draggable key={list.id} draggableId={`list-${list.id}`} index={listIndex}>
                {(listDragProvided) => (
                  <div
                    ref={listDragProvided.innerRef}
                    {...listDragProvided.draggableProps}
                    {...listDragProvided.dragHandleProps}
                    style={{
                      ...listDragProvided.draggableProps.style,
                      flexShrink: 0,
                    }}
                  >
                    <ListColumn
                      list={list}
                      showNewCard={showNewCard === list.id}
                      newCardTitle={newCardTitle}
                      onShowNewCard={() => setShowNewCard(list.id)}
                      onNewCardTitleChange={setNewCardTitle}
                      onCreateCard={() => handleCreateCard(list.id)}
                      onCancelNewCard={() => {
                        setShowNewCard(null);
                        setNewCardTitle('');
                      }}
                      isCreatingCard={createCardMutation.isPending}
                      draggingCardId={draggingCardId}
                      onCardClick={setSelectedCard}
                      onCardContextMenu={handleCardContextMenu}
                      onListMenuClick={handleListMenuClick}
                      onRenameList={handleRenameList}
                      onToggleCardComplete={(cardId: string, isCompleted: boolean) => {
                        updateCardMutation.mutate({ cardId, updates: { isCompleted } });
                      }}
                      searchTerm={searchTerm}
                      highlightedCards={highlightedCards}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {boardProvided.placeholder}

          {/* Add List */}
          {showNewList ? (
            <div
              className="flex-shrink-0 w-[280px] rounded-[14px] p-4 shadow-lg"
              style={{
                background: 'var(--surface-overlay)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--border-default)',
              }}
            >
              <form onSubmit={handleCreateList}>
                <input
                  type="text"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  placeholder="Digite o nome da lista..."
                  className="w-full px-4 py-2.5 rounded-xl focus:outline-none"
                  style={{
                    background: 'var(--surface-card-solid)',
                    color: 'var(--text-primary)',
                    border: '1.5px solid var(--border-accent-strong)',
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowNewList(false);
                      setNewListTitle('');
                    }
                  }}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    type="submit"
                    disabled={!newListTitle.trim() || createListMutation.isPending}
                    className="px-4 py-2 text-white rounded-lg transition-all text-sm font-medium disabled:opacity-50"
                    style={{
                      background: 'var(--gradient-primary)',
                    }}
                  >
                    Adicionar lista
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewList(false);
                      setNewListTitle('');
                    }}
                    className="px-3 py-2 rounded-lg transition-colors text-sm"
                    style={{
                      color: 'var(--text-faint)',
                      background: 'var(--surface-subtle)',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button
              onClick={() => setShowNewList(true)}
              className="flex-shrink-0 w-[280px] h-auto min-h-[100px] rounded-[14px] transition-all flex flex-col items-center justify-center gap-1.5 font-medium"
              style={{
                background: 'var(--surface-overlay)',
                backdropFilter: 'blur(10px)',
                border: '1.5px dashed var(--border-visible)',
                color: 'var(--text-dimmed)',
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform"
                style={{ background: 'var(--accent-bg)' }}
              >
                <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                </svg>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-dimmed)', fontWeight: 500 }}>Adicionar lista</span>
            </button>
          )}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        </div>
        )}

        {/* Card Modal */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          boardId={boardId!}
          isOpen={!!selectedCard}
          onClose={() => setSelectedCard(null)}
          availableLabels={board?.labels || []}
          boardMembers={board?.members || []}
        />
      )}

      {/* List Context Menu */}
      {listMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setListMenuOpen(null)}
          />
          <div
            className="fixed z-50 rounded-xl shadow-2xl p-2 min-w-[200px]"
            style={{
              top: `${listMenuOpen.y}px`,
              left: `${listMenuOpen.x}px`,
              background: 'var(--surface-primary)',
              border: '1px solid var(--border-color)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <button
              onClick={() => {
                setEditingListColor(listMenuOpen.list);
                setListMenuOpen(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm hover:translate-x-1"
              style={{
                color: 'var(--text-primary)',
                background: 'transparent',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              Alterar cor
            </button>
            <div className="my-1 h-px" style={{ background: 'var(--border-color)' }} />
            <button
              onClick={() => {
                handleDeleteList(listMenuOpen.list.id);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm hover:translate-x-1"
              style={{
                color: '#ef4444',
                background: 'transparent',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Deletar lista
            </button>
          </div>
        </>
      )}

      {/* Color Picker Modal */}
      {editingListColor && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setEditingListColor(null)}
          />
          <div
            className="fixed z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl p-6 w-80"
            style={{
              background: 'var(--surface-primary)',
              border: '1px solid var(--border-color)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Alterar Cor da Lista
              </h3>
              <button
                onClick={() => setEditingListColor(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:rotate-90"
                style={{
                  background: 'var(--surface-secondary)',
                  color: 'var(--text-secondary)',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Color Picker Customizado */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                Personalizar Cor
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="w-16 h-12 rounded-xl cursor-pointer border-2"
                  style={{ borderColor: 'var(--border-color)' }}
                />
                <button
                  onClick={handleSaveCustomColor}
                  className="flex-1 px-4 py-2 rounded-xl font-medium transition-all hover:scale-105 text-white text-sm"
                  style={{
                    background: 'var(--gradient-primary)',
                  }}
                >
                  Salvar e Aplicar
                </button>
              </div>
            </div>

            {/* Cores Padrão */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                Cores Padrão
              </label>
              <div className="grid grid-cols-4 gap-3">
                {[
                  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
                  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
                  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                  'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)',
                  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
                  'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                ].map((color, index) => (
                  <button
                    key={index}
                    onClick={() => handleChangeListColor(editingListColor, color)}
                    className="w-full h-12 rounded-xl transition-all hover:scale-110 shadow-md"
                    style={{
                      background: color,
                      border: color.includes('0.05') ? '2px dashed var(--border-color)' : 'none',
                    }}
                    title={color.includes('0.05') ? 'Padrão' : 'Gradiente'}
                  >
                    {color.includes('0.05') && (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Padrão</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Cores Salvas */}
            {savedColors.length > 0 && (
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Minhas Cores Salvas
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {savedColors.map((color, index) => (
                    <div key={index} className="relative group">
                      <button
                        onClick={() => handleChangeListColor(editingListColor, color)}
                        className="w-full h-12 rounded-xl transition-all hover:scale-110 shadow-md"
                        style={{ background: color }}
                        title="Usar esta cor"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSavedColor(color);
                        }}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remover cor"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Card Context Menu */}
      {cardMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setCardMenuOpen(null)}
          />
          <div
            className="fixed z-50 rounded-xl shadow-2xl p-2 min-w-[200px]"
            style={{
              top: `${cardMenuOpen.y}px`,
              left: `${cardMenuOpen.x}px`,
              background: 'var(--surface-primary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              onClick={() => handleStartEditingCardTitle(cardMenuOpen.card)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm hover:translate-x-1"
              style={{
                color: 'var(--text-primary)',
                background: 'transparent',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Renomear
            </button>
            <button
              onClick={() => handleDuplicateCard(cardMenuOpen.card.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm hover:translate-x-1"
              style={{
                color: 'var(--text-primary)',
                background: 'transparent',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Duplicar
            </button>
            <button
              onClick={() => handleOpenCardDateDropdown(cardMenuOpen.card)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm hover:translate-x-1"
              style={{
                color: 'var(--text-primary)',
                background: 'transparent',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Editar data
            </button>
            <button
              onClick={() => handleOpenCardCoverDropdown(cardMenuOpen.card)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm hover:translate-x-1"
              style={{
                color: 'var(--text-primary)',
                background: 'transparent',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Alterar capa
            </button>
            <button
              onClick={() => handleOpenCardMembersDropdown(cardMenuOpen.card)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm hover:translate-x-1"
              style={{
                color: 'var(--text-primary)',
                background: 'transparent',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Alterar membro
            </button>
            <button
              onClick={() => handleOpenCardLabelsDropdown(cardMenuOpen.card)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm hover:translate-x-1"
              style={{
                color: 'var(--text-primary)',
                background: 'transparent',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Etiqueta
            </button>
            <button
              onClick={() => handleArchiveCard(cardMenuOpen.card.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm hover:translate-x-1"
              style={{
                color: 'var(--text-primary)',
                background: 'transparent',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Arquivar
            </button>
            <div className="my-1 h-px" style={{ background: 'var(--border-color)' }} />
            <button
              onClick={() => handleDeleteCard(cardMenuOpen.card.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm hover:translate-x-1"
              style={{
                color: '#ef4444',
                background: 'transparent',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Deletar card
            </button>
          </div>
        </>
      )}

      {/* Inline Card Title Editor */}
      {editingCardTitle && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setEditingCardTitle(null)}
          />
          <div
            className="fixed z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl p-6 w-96"
            style={{
              background: 'var(--surface-primary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Renomear Card
            </h3>
            <input
              type="text"
              value={editingCardTitle.title}
              onChange={(e) => setEditingCardTitle({ ...editingCardTitle, title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveCardTitle();
                } else if (e.key === 'Escape') {
                  setEditingCardTitle(null);
                }
              }}
              className="w-full px-3 py-2 rounded-lg border mb-4"
              style={{
                background: 'var(--surface-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingCardTitle(null)}
                className="px-4 py-2 rounded-lg transition-colors"
                style={{
                  background: 'var(--surface-secondary)',
                  color: 'var(--text-secondary)',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCardTitle}
                disabled={!editingCardTitle.title.trim()}
                className="px-4 py-2 rounded-lg transition-colors text-white disabled:opacity-50"
                style={{
                  background: 'var(--gradient-primary)',
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Card Date Dropdown */}
      {cardDateDropdownOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setCardDateDropdownOpen(null)}
          />
          <div
            className="fixed z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl p-6 w-80"
            style={{
              background: 'var(--surface-primary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Editar Data
            </h3>
            <input
              type="text"
              placeholder="dd/mm/aaaa"
              value={dateInputValue}
              onChange={(e) => {
                const masked = applyDateMask(e.target.value);
                setDateInputValue(masked);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const isoDate = formatDateToISO(dateInputValue);
                  if (isoDate) {
                    updateCardMutation.mutate({
                      cardId: cardDateDropdownOpen.id,
                      updates: { dueDate: isoDate },
                    });
                  }
                } else if (e.key === 'Escape') {
                  setCardDateDropdownOpen(null);
                }
              }}
              maxLength={10}
              className="w-full px-3 py-2 rounded-lg border mb-2"
              style={{
                background: 'var(--surface-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              autoFocus
            />
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
              Formato: dia/mês/ano
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  updateCardMutation.mutate({
                    cardId: cardDateDropdownOpen.id,
                    updates: { dueDate: undefined },
                  });
                }}
                className="flex-1 px-4 py-2 rounded-lg transition-colors"
                style={{
                  background: 'var(--surface-secondary)',
                  color: 'var(--text-secondary)',
                }}
              >
                Remover
              </button>
              <button
                onClick={() => {
                  const isoDate = formatDateToISO(dateInputValue);
                  if (isoDate) {
                    updateCardMutation.mutate({
                      cardId: cardDateDropdownOpen.id,
                      updates: { dueDate: isoDate },
                    });
                  }
                }}
                disabled={!formatDateToISO(dateInputValue)}
                className="flex-1 px-4 py-2 rounded-lg transition-colors text-white disabled:opacity-50"
                style={{
                  background: 'var(--gradient-primary)',
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Card Cover Dropdown */}
      {cardCoverDropdownOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setCardCoverDropdownOpen(null)}
          />
          <div
            className="fixed z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl p-6 w-96 max-h-[80vh] overflow-y-auto"
            style={{
              background: 'var(--surface-primary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Alterar Capa
            </h3>
            {cardCoverDropdownOpen.attachments && cardCoverDropdownOpen.attachments.length > 0 ? (
              <div className="space-y-2 mb-4">
                {cardCoverDropdownOpen.attachments.map((att: any) => (
                  <button
                    key={att.id}
                    onClick={() => {
                      cardService.setCover(cardCoverDropdownOpen.id, att.id);
                      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
                      setCardCoverDropdownOpen(null);
                    }}
                    className="w-full p-2 rounded-lg border transition-all hover:scale-105"
                    style={{
                      borderColor: cardCoverDropdownOpen.coverAttachmentId === att.id ? 'var(--accent)' : 'var(--border-color)',
                      background: 'var(--surface-secondary)',
                    }}
                  >
                    <img src={att.url} alt={att.name} className="w-full h-24 object-cover rounded" />
                    <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>{att.name}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Nenhum anexo disponível. Adicione anexos ao card para usá-los como capa.
              </p>
            )}
            <button
              onClick={() => {
                cardService.setCover(cardCoverDropdownOpen.id, null);
                queryClient.invalidateQueries({ queryKey: ['board', boardId] });
                setCardCoverDropdownOpen(null);
              }}
              className="w-full px-4 py-2 rounded-lg transition-colors mb-2"
              style={{
                background: 'var(--surface-secondary)',
                color: 'var(--text-secondary)',
              }}
            >
              Remover Capa
            </button>
            <button
              onClick={() => setCardCoverDropdownOpen(null)}
              className="w-full px-4 py-2 rounded-lg transition-colors text-white"
              style={{
                background: 'var(--gradient-primary)',
              }}
            >
              Fechar
            </button>
          </div>
        </>
      )}

      {/* Card Members Dropdown */}
      {cardMembersDropdownOpen && (() => {
        const freshCard = board?.lists
          ?.flatMap((l: any) => l.cards || [])
          .find((c: any) => c.id === cardMembersDropdownOpen.id) || cardMembersDropdownOpen;
        return (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setCardMembersDropdownOpen(null)}
          />
          <div
            className="fixed z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl p-6 w-80 max-h-[80vh] overflow-y-auto"
            style={{
              background: 'var(--surface-primary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Membros
            </h3>
            {board?.members && board.members.length > 0 ? (
              <div className="space-y-2">
                {board.members.map((member: any) => {
                  const isAssigned = freshCard.members?.some((m: any) => m.user.id === member.user.id);
                  return (
                    <button
                      key={member.user.id}
                      onClick={() => {
                        if (isAssigned) {
                          removeCardMemberMutation.mutate({
                            cardId: freshCard.id,
                            userId: member.user.id,
                          });
                        } else {
                          addCardMemberMutation.mutate({
                            cardId: freshCard.id,
                            userId: member.user.id,
                          });
                        }
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg transition-all hover:scale-105"
                      style={{
                        background: isAssigned ? 'var(--accent)' : 'var(--surface-secondary)',
                        color: isAssigned ? 'white' : 'var(--text-primary)',
                      }}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold" style={{ background: 'var(--accent)' }}>
                        {member.user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 text-left">{member.user.name}</span>
                      {isAssigned && (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Nenhum membro disponível no board.
              </p>
            )}
            <button
              onClick={() => setCardMembersDropdownOpen(null)}
              className="w-full mt-4 px-4 py-2 rounded-lg transition-colors text-white"
              style={{
                background: 'var(--gradient-primary)',
              }}
            >
              Fechar
            </button>
          </div>
        </>
        );
      })()}

      {/* Card Labels Dropdown */}
      {cardLabelsDropdownOpen && (() => {
        const freshCard = board?.lists
          ?.flatMap((l: any) => l.cards || [])
          .find((c: any) => c.id === cardLabelsDropdownOpen.id) || cardLabelsDropdownOpen;
        return (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setCardLabelsDropdownOpen(null)}
          />
          <div
            className="fixed z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl p-6 w-80 max-h-[80vh] overflow-y-auto"
            style={{
              background: 'var(--surface-primary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Etiquetas
            </h3>
            {board?.labels && board.labels.length > 0 ? (
              <div className="space-y-2">
                {board.labels.map((label: any) => {
                  const isAssigned = freshCard.labels?.some((l: any) => l.label.id === label.id);
                  return (
                    <button
                      key={label.id}
                      onClick={() => {
                        if (isAssigned) {
                          removeCardLabelMutation.mutate({
                            cardId: freshCard.id,
                            labelId: label.id,
                          });
                        } else {
                          addCardLabelMutation.mutate({
                            cardId: freshCard.id,
                            labelId: label.id,
                          });
                        }
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg transition-all hover:scale-105"
                      style={{
                        background: label.color,
                        color: 'white',
                        opacity: isAssigned ? 1 : 0.6,
                      }}
                    >
                      <span className="flex-1 text-left font-medium">{label.name}</span>
                      {isAssigned && (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Nenhuma etiqueta disponível. Crie etiquetas no board primeiro.
              </p>
            )}
            <button
              onClick={() => setCardLabelsDropdownOpen(null)}
              className="w-full mt-4 px-4 py-2 rounded-lg transition-colors text-white"
              style={{
                background: 'var(--gradient-primary)',
              }}
            >
              Fechar
            </button>
          </div>
        </>
        );
      })()}

      {/* Background Customization Modal */}
      {showBackgroundModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowBackgroundModal(false)}
          />
          <div
            className="fixed z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl p-6 w-[480px] max-h-[80vh] overflow-y-auto"
            style={{
              background: 'var(--surface-primary)',
              border: '1px solid var(--border-color)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Personalizar Fundo do Board
              </h3>
              <button
                onClick={() => setShowBackgroundModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:rotate-90"
                style={{
                  background: 'var(--surface-secondary)',
                  color: 'var(--text-secondary)',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setBackgroundType('color')}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: backgroundType === 'color' ? 'var(--gradient-primary)' : 'var(--surface-secondary)',
                  color: backgroundType === 'color' ? 'white' : 'var(--text-secondary)',
                }}
              >
                Cores
              </button>
              <button
                onClick={() => setBackgroundType('image')}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: backgroundType === 'image' ? 'var(--gradient-primary)' : 'var(--surface-secondary)',
                  color: backgroundType === 'image' ? 'white' : 'var(--text-secondary)',
                }}
              >
                Imagens
              </button>
            </div>

            {/* Color Tab */}
            {backgroundType === 'color' && (
              <div>
                {/* Custom Color Picker */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                    Personalizar Cor
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={customBoardColor}
                      onChange={(e) => setCustomBoardColor(e.target.value)}
                      className="w-20 h-14 rounded-xl cursor-pointer border-2"
                      style={{ borderColor: 'var(--border-color)' }}
                    />
                    <button
                      onClick={() => handleApplyBackgroundColor(`linear-gradient(135deg, ${customBoardColor} 0%, ${customBoardColor} 100%)`)}
                      className="flex-1 px-4 py-2 rounded-xl font-medium transition-all hover:scale-105 text-white text-sm"
                      style={{
                        background: 'var(--gradient-primary)',
                      }}
                    >
                      Aplicar Cor Personalizada
                    </button>
                  </div>
                </div>

                {/* Gradient Presets */}
                <div>
                  <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                    Gradientes Prontos
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { name: 'Tema Escuro', gradient: 'linear-gradient(145deg, #1a1d2e 0%, #2d1b4e 35%, #1b2a4a 65%, #141825 100%)' },
                      { name: 'Trello Azul', gradient: 'linear-gradient(135deg, #0079bf 0%, #5e4db2 100%)' },
                      { name: 'Roxo Profundo', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
                      { name: 'Rosa Vibrante', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
                      { name: 'Azul Céu', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
                      { name: 'Verde Água', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
                      { name: 'Pôr do Sol', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
                      { name: 'Oceano Profundo', gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' },
                      { name: 'Pastel Suave', gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
                      { name: 'Rosa Delicado', gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' },
                      { name: 'Pêssego', gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
                      { name: 'Coral Azul', gradient: 'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)' },
                      { name: 'Lavanda', gradient: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' },
                    ].map((preset, index) => (
                      <button
                        key={index}
                        onClick={() => handleApplyBackgroundColor(preset.gradient)}
                        className="h-24 rounded-xl transition-all hover:scale-105 shadow-lg relative overflow-hidden group"
                        style={{ background: preset.gradient }}
                        title={preset.name}
                      >
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                          <span className="text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity px-2 text-center">
                            {preset.name}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Solid Colors */}
                <div className="mt-6">
                  <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                    Cores Sólidas
                  </label>
                  <div className="grid grid-cols-6 gap-3">
                    {[
                      { name: 'Azul', color: '#0079bf' },
                      { name: 'Verde', color: '#61bd4f' },
                      { name: 'Amarelo', color: '#f2d600' },
                      { name: 'Laranja', color: '#ff9f1a' },
                      { name: 'Vermelho', color: '#eb5a46' },
                      { name: 'Roxo', color: '#c377e0' },
                      { name: 'Rosa', color: '#ff78cb' },
                      { name: 'Cinza', color: '#838c91' },
                      { name: 'Azul Escuro', color: '#344563' },
                      { name: 'Verde Escuro', color: '#1f845a' },
                      { name: 'Marrom', color: '#7c5127' },
                      { name: 'Preto', color: '#172b4d' },
                    ].map((color, index) => (
                      <button
                        key={index}
                        onClick={() => handleApplyBackgroundColor(color.color)}
                        className="h-12 rounded-lg transition-all hover:scale-110 shadow-md"
                        style={{ backgroundColor: color.color }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Image Tab */}
            {backgroundType === 'image' && (
              <div>
                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                    URL da Imagem
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="https://exemplo.com/imagem.jpg"
                      className="flex-1 px-4 py-3 rounded-xl focus:outline-none"
                      style={{
                        background: 'var(--surface-secondary)',
                        color: 'var(--text-primary)',
                        border: '2px solid var(--border-color)',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.target as HTMLInputElement;
                          if (input.value.trim()) {
                            handleApplyBackgroundImage(input.value.trim());
                          }
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        if (input.value.trim()) {
                          handleApplyBackgroundImage(input.value.trim());
                        }
                      }}
                      className="px-6 py-3 rounded-xl font-medium transition-all hover:scale-105 text-white text-sm whitespace-nowrap"
                      style={{
                        background: 'var(--gradient-primary)',
                      }}
                    >
                      Aplicar
                    </button>
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                    Cole a URL de uma imagem hospedada online
                  </p>
                </div>

                {/* Image Presets */}
                <div>
                  <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                    Imagens Sugeridas
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { name: 'Montanhas', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80' },
                      { name: 'Oceano', url: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1920&q=80' },
                      { name: 'Floresta', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80' },
                      { name: 'Cidade', url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&q=80' },
                      { name: 'Espaço', url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&q=80' },
                      { name: 'Abstrato', url: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1920&q=80' },
                    ].map((image, index) => (
                      <button
                        key={index}
                        onClick={() => handleApplyBackgroundImage(image.url)}
                        className="h-32 rounded-xl transition-all hover:scale-105 shadow-lg relative overflow-hidden group"
                        style={{
                          backgroundImage: `url(${image.url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      >
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all flex items-end justify-center pb-3">
                          <span className="text-white text-sm font-semibold">
                            {image.name}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Remove Background */}
                <div className="mt-6">
                  <button
                    onClick={() => updateBoardMutation.mutate({ backgroundColor: undefined, backgroundImageUrl: undefined })}
                    className="w-full px-4 py-3 rounded-xl font-medium transition-all hover:scale-105 text-sm"
                    style={{
                      background: 'var(--surface-secondary)',
                      color: 'var(--text-primary)',
                      border: '2px dashed var(--border-color)',
                    }}
                  >
                    Remover Fundo (Usar Padrão)
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Archived Items Modal */}
      {showArchivedModal && (
        <ArchivedItemsModal
          boardId={boardId!}
          onClose={() => setShowArchivedModal(false)}
        />
      )}

      {/* Members Modal */}
      {board && (
        <BoardMembersModal
          board={board}
          isOpen={showMembersModal}
          onClose={() => setShowMembersModal(false)}
        />
      )}

      {/* Stats Modal */}
      {board && (
        <BoardStatsModal
          board={board}
          isOpen={showStatsModal}
          onClose={() => setShowStatsModal(false)}
        />
      )}
      <ConfirmDialog />

      {/* Keyboard Shortcuts Help Overlay */}
      {showShortcuts && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowShortcuts(false);
          }}
        >
          <div
            style={{
              background: 'var(--surface-dropdown)',
              border: '1px solid var(--border-accent)',
              borderRadius: '16px',
              padding: '28px 32px',
              minWidth: '340px',
              maxWidth: '420px',
              position: 'relative',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowShortcuts(false)}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'var(--border-default)',
                border: 'none',
                color: 'var(--text-faint)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--border-visible)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'rotate(90deg)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--border-default)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'rotate(0deg)';
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 style={{
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '18px',
              marginBottom: '20px',
            }}>
              Atalhos de Teclado
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { key: 'N', desc: 'Novo card' },
                { key: 'F', desc: 'Filtros' },
                { key: '/', desc: 'Buscar' },
                { key: 'Ctrl+K', desc: 'Buscar' },
                { key: 'Escape', desc: 'Fechar menu / limpar busca' },
                { key: '?', desc: 'Mostrar atalhos' },
              ].map(({ key, desc }) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  <kbd
                    style={{
                      background: 'var(--surface-board-header)',
                      border: '1px solid var(--border-accent-strong)',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontFamily: 'monospace',
                      color: 'var(--accent)',
                      fontSize: '13px',
                      fontWeight: 600,
                      minWidth: '60px',
                      textAlign: 'center',
                      lineHeight: '1.6',
                    }}
                  >
                    {key}
                  </kbd>
                  <span style={{ color: 'var(--text-faint)', fontSize: '14px' }}>
                    {desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
      </div>
    </MainLayout>
  );
}
