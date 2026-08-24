'use client';

import { requireStudentAccess } from "@/components/StudentGate";

interface ClientGateLinkProps {
  url: string;
  children: React.ReactNode;
  className?: string;
}

export function ClientGateLink({ url, children, className }: ClientGateLinkProps) {
  const handleOpen = () => {
    requireStudentAccess(() => {
      let fullUrl = url.startsWith('http') 
        ? url 
        : `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${url}`;
      fullUrl = encodeURI(fullUrl);
      window.open(fullUrl, '_blank');
    });
  };

  return (
    <div className={className} onClick={handleOpen} style={{ cursor: 'pointer' }}>
      {children}
    </div>
  );
}
