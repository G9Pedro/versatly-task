import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invitationService } from '../services/invitationService';
export default function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // Fetch invitation details (we'll need to add this to the service)
  const { data: invitations, isLoading } = useQuery({
    queryKey: ['myInvitations'],
    queryFn: () => invitationService.getMyInvitations(),
  });

  // Find the invitation with the matching token
  const invitation = invitations?.invitations.find((inv) => inv.token === token);

  const acceptMutation = useMutation({
    mutationFn: () => invitationService.acceptInvitation(token!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['myInvitations'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['boards'] });

      // Redirect based on invitation type
      if (data.type === 'WORKSPACE' && data.workspaceId) {
        navigate('/dashboard');
      } else if (data.type === 'BOARD' && data.boardId) {
        navigate(`/board/${data.boardId}`);
      } else {
        navigate('/dashboard');
      }
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Erro ao aceitar convite');
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => invitationService.declineInvitation(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myInvitations'] });
      navigate('/dashboard');
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Erro ao recusar convite');
    },
  });

  useEffect(() => {
    if (!token) {
      setError('Token de convite inválido');
    }
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-base)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Carregando convite...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-base)' }}>
        <div className="max-w-md w-full mx-4 p-8 rounded-2xl" style={{ background: 'var(--surface-primary)', border: '1px solid var(--border-color)' }}>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Convite não encontrado
            </h2>
            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
              {error || 'Este convite pode ter expirado ou já foi processado.'}
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 rounded-lg font-medium"
              style={{ background: 'var(--gradient-primary)', color: 'white' }}
            >
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getInvitationTypeText = () => {
    if (invitation.type === 'WORKSPACE') {
      return invitation.workspace?.name || 'workspace';
    }
    return invitation.board?.name || 'board';
  };

  const getInvitationTypeLabel = () => {
    return invitation.type === 'WORKSPACE' ? 'Workspace' : 'Board';
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-base)' }}>
      <div className="max-w-md w-full mx-4 p-8 rounded-2xl" style={{ background: 'var(--surface-primary)', border: '1px solid var(--border-color)' }}>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Convite Recebido
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Você foi convidado para participar
          </p>
        </div>

        {/* Invitation Details */}
        <div className="space-y-4 mb-6">
          {/* Inviter */}
          <div className="p-4 rounded-xl" style={{ background: 'var(--surface-secondary)' }}>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              Convidado por
            </p>
            <div className="flex items-center gap-3">
              {invitation.inviter.avatarUrl ? (
                <img
                  src={invitation.inviter.avatarUrl}
                  alt={invitation.inviter.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                  {invitation.inviter.name[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {invitation.inviter.name}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {invitation.inviter.email}
                </p>
              </div>
            </div>
          </div>

          {/* Workspace/Board Info */}
          <div className="p-4 rounded-xl" style={{ background: 'var(--surface-secondary)' }}>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              {getInvitationTypeLabel()}
            </p>
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {getInvitationTypeText()}
            </p>
          </div>

          {/* Role */}
          <div className="p-4 rounded-xl" style={{ background: 'var(--surface-secondary)' }}>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              Sua função
            </p>
            <span
              className="inline-block px-3 py-1 rounded-lg text-sm font-medium"
              style={{
                background: invitation.role === 'ADMIN'
                  ? 'var(--gradient-primary)'
                  : 'var(--surface-hover)',
                color: invitation.role === 'ADMIN' ? 'white' : 'var(--text-primary)',
              }}
            >
              {invitation.role}
            </span>
          </div>

          {/* Expiration */}
          <div className="p-4 rounded-xl" style={{ background: 'var(--surface-secondary)' }}>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              Expira em
            </p>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {new Date(invitation.expiresAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending || declineMutation.isPending}
            className="flex-1 px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50"
            style={{ background: 'var(--gradient-primary)', color: 'white' }}
          >
            {acceptMutation.isPending ? 'Aceitando...' : 'Aceitar Convite'}
          </button>
          <button
            onClick={() => declineMutation.mutate()}
            disabled={acceptMutation.isPending || declineMutation.isPending}
            className="px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50"
            style={{ background: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}
          >
            {declineMutation.isPending ? 'Recusando...' : 'Recusar'}
          </button>
        </div>
      </div>
    </div>
  );
}
