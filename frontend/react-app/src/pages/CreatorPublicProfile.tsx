import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export function CreatorPublicProfile() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!handle) return;
    navigate(`/chat/${handle}`, { replace: true });
  }, [handle, navigate]);

  return null;
}
