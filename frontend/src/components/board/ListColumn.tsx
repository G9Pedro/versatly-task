import { useState, memo } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { motion } from 'framer-motion';
import CardItem, { formatCompletionTime } from './CardItem';
import type { Card } from '../../types';

interface ListColumnProps {
  list: any;
  showNewCard: boolean;
  newCardTitle: string;
  onShowNewCard: () => void;
  onNewCardTitleChange: (value: string) => void;
  onCreateCard: () => void;
  onCancelNewCard: () => void;
  isCreatingCard: boolean;
  draggingCardId: string | null;
  onCardClick: (card: Card) => void;
  onCardContextMenu: (e: React.MouseEvent, card: Card) => void;
  onListMenuClick: (e: React.MouseEvent, list: any) => void;
  onRenameList: (listId: string, newTitle: string) => void;
  onToggleCardComplete: (cardId: string, isCompleted: boolean) => void;
  searchTerm: string;
  highlightedCards: Set<string>;
}

const ListColumn = memo(
  ({
    list,
    showNewCard,
    newCardTitle,
    onShowNewCard,
    onNewCardTitleChange,
    onCreateCard,
    onCancelNewCard,
    isCreatingCard,
    draggingCardId,
    onCardClick,
    onCardContextMenu,
    onListMenuClick,
    onRenameList,
    onToggleCardComplete,
    searchTerm,
    highlightedCards,
  }: ListColumnProps) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(list.title);

    const handleStartEditing = () => {
      setIsEditingTitle(true);
      setEditedTitle(list.title);
    };

    const handleFinishEditing = () => {
      if (editedTitle.trim() && editedTitle !== list.title) {
        onRenameList(list.id, editedTitle.trim());
      } else {
        setEditedTitle(list.title);
      }
      setIsEditingTitle(false);
    };

    const handleCancelEditing = () => {
      setEditedTitle(list.title);
      setIsEditingTitle(false);
    };

    return (
      <div
        className="rounded-[14px] transition-all duration-300 flex flex-col"
        style={{
          width: 280,
          minWidth: 280,
          flexShrink: 0,
          overflow: 'hidden',
          transform: 'none',
          background: 'var(--surface-base)',
          border: '1px solid var(--border-default)',
          maxHeight: 'calc(100vh - 180px)',
          boxShadow: list.backgroundColor
            ? `0 4px 20px -2px ${list.backgroundColor.includes('gradient')
                ? 'rgba(102, 126, 234, 0.15)'
                : list.backgroundColor + '40'}, var(--shadow-sm)`
            : 'var(--shadow-md)',
        }}
      >
        <div
          className="flex flex-col min-h-0 h-full"
        >
        {/* List Header */}
        <div
          className="group relative overflow-hidden"
          style={{
            padding: '12px 14px 10px',
            background: 'transparent',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          {/* Barra colorida no topo */}
          {list.backgroundColor && (
            <div
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{
                background: list.backgroundColor,
              }}
            />
          )}

          <div className="flex items-center justify-between gap-2 relative z-10">
            {isEditingTitle ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleFinishEditing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleFinishEditing();
                  }
                  if (e.key === 'Escape') {
                    handleCancelEditing();
                  }
                }}
                className="font-semibold flex-1 px-1.5 py-0.5 rounded-md focus:outline-none"
                style={{
                  color: 'var(--text-primary)',
                  fontSize: '13.5px',
                  background: 'var(--surface-editing)',
                  border: '1.5px solid var(--border-focus)',
                }}
                autoFocus
                onFocus={(e) => e.target.select()}
              />
            ) : (
              <h3
                className="font-semibold flex-1 cursor-pointer px-1.5 py-0.5 rounded-md hover:bg-opacity-50 transition-all"
                style={{ color: 'var(--text-primary)', fontSize: '13.5px' }}
                onClick={handleStartEditing}
                onDoubleClick={handleStartEditing}
                title="Clique para renomear"
              >
                {list.title}
              </h3>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onListMenuClick(e, list);
              }}
              className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center transition-all hover:scale-110 opacity-0 group-hover:opacity-100 flex-shrink-0"
              style={{
                background: 'transparent',
                color: 'var(--text-dimmed)',
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            <span
              className="font-semibold px-2 rounded-[10px] flex-shrink-0"
              style={{
                color: 'var(--text-dimmed)',
                fontSize: '11px',
                padding: '2px 8px',
                background: 'var(--surface-subtle)',
              }}
            >
              {list.cards?.length || 0}
            </span>
          </div>
        </div>

        {/* Cards Container */}
        <Droppable droppableId={list.id} type="CARD">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex-1 overflow-y-auto flex flex-col gap-2 board-column-scroll"
              style={{
                minHeight: '10px',
                padding: '2px 10px 6px',
                background: snapshot.isDraggingOver ? 'var(--accent-bg-subtle)' : 'transparent',
                transition: 'background 0.2s ease',
              }}
            >
              {list.cards
                ?.filter((card: Card) => {
                  if (!searchTerm) return true;
                  const search = searchTerm.toLowerCase();
                  return (
                    card.title?.toLowerCase().includes(search) ||
                    card.description?.toLowerCase().includes(search) ||
                    card.labels?.some(cl => cl.label?.name?.toLowerCase().includes(search))
                  );
                })
                .map((card: Card, index: number) => {
                const isBeingDragged = draggingCardId === card.id;
                const isHighlighted = highlightedCards.has(card.id);

                return (
                  <Draggable key={card.id} draggableId={card.id} index={index}>
                    {(provided, snapshot) => (
                      <motion.div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...(() => { const { onDragStart: _, ...rest } = provided.dragHandleProps || {}; return rest; })()}
                        onClick={() => !snapshot.isDragging && onCardClick(card)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          onCardContextMenu(e, card);
                        }}
                        className="rounded-[10px] cursor-pointer transition-all hover:scale-[1.02] group"
                        style={{
                          ...provided.draggableProps.style,
                          padding: '10px 12px',
                          background: 'var(--surface-card)',
                          border: isHighlighted
                            ? '2px solid var(--accent-highlight)'
                            : '1px solid var(--border-subtle)',
                          boxShadow: snapshot.isDragging
                            ? 'var(--shadow-drag)'
                            : isHighlighted
                            ? 'var(--shadow-glow)'
                            : 'none',
                          opacity: isBeingDragged && !snapshot.isDragging ? 0 : 1,
                          pointerEvents: isBeingDragged && !snapshot.isDragging ? 'none' : 'auto',
                        }}
                        animate={!snapshot.isDragging && isHighlighted ? {
                          scale: [1, 1.03, 1],
                          transition: { duration: 0.5, ease: "easeInOut" }
                        } : {}}
                      >
                        <CardItem card={card} formatTime={formatCompletionTime} onToggleComplete={onToggleCardComplete} />
                      </motion.div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* Add Card Button */}
        <div style={{ padding: '6px 10px 10px', flexShrink: 0 }}>
          {showNewCard ? (
            <div
              className="rounded-lg p-3 shadow-sm"
              style={{
                background: 'var(--surface-card-solid)',
                border: '1px solid var(--border-accent-medium)',
              }}
            >
              <textarea
                value={newCardTitle}
                onChange={(e) => onNewCardTitleChange(e.target.value)}
                placeholder="Digite o título do card..."
                className="w-full px-3 py-2 rounded-lg focus:outline-none resize-none text-sm"
                style={{
                  background: 'var(--surface-input)',
                  color: 'var(--text-primary)',
                  border: '1.5px solid var(--border-accent-strong)',
                }}
                rows={2}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onCreateCard();
                  }
                  if (e.key === 'Escape') {
                    onCancelNewCard();
                  }
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={onCreateCard}
                  disabled={!newCardTitle.trim() || isCreatingCard}
                  className="px-4 py-2 text-white rounded-lg transition-all text-sm font-semibold disabled:opacity-50 hover:scale-105"
                  style={{
                    background: 'var(--gradient-primary)',
                  }}
                >
                  Adicionar
                </button>
                <button
                  onClick={onCancelNewCard}
                  className="px-3 py-2 rounded-lg transition-all text-sm font-medium hover:scale-105"
                  style={{
                    color: 'var(--text-faint)',
                    background: 'var(--surface-subtle)',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onShowNewCard}
              className="w-full rounded-lg transition-all font-medium text-left flex items-center gap-1.5 hover:scale-[1.02] hover:shadow-sm"
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                color: 'var(--text-dimmed)',
                fontSize: '12px',
                background: 'transparent',
                border: '1.5px dashed var(--border-visible)',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Adicionar card
            </button>
          )}
        </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      JSON.stringify(prevProps.list) === JSON.stringify(nextProps.list) &&
      prevProps.showNewCard === nextProps.showNewCard &&
      prevProps.newCardTitle === nextProps.newCardTitle &&
      prevProps.isCreatingCard === nextProps.isCreatingCard &&
      prevProps.draggingCardId === nextProps.draggingCardId &&
      prevProps.onCardClick === nextProps.onCardClick &&
      prevProps.onRenameList === nextProps.onRenameList
    );
  }
);

ListColumn.displayName = 'ListColumn';

export default ListColumn;
