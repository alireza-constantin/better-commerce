import { useMutation } from '@tanstack/react-query';
import { isAdminApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { logout } from './api/auth-api';

export function LogoutButton() {
  const logoutMutation = useMutation({
    mutationFn: logout,
  });
  const problem = isAdminApiError(logoutMutation.error)
    ? logoutMutation.error.problem
    : undefined;

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        disabled={logoutMutation.isPending}
        onClick={() => logoutMutation.mutate()}
        variant="outline"
      >
        {logoutMutation.isPending ? 'در حال خروج…' : 'خروج'}
      </Button>
      {logoutMutation.isError ? (
        <p
          aria-live="polite"
          className="max-w-64 text-end text-xs leading-5 text-destructive"
          role="alert"
        >
          خروج از حساب تأیید نشد. دوباره تلاش کنید.
          {problem && 'requestId' in problem && problem.requestId
            ? (
                <>
                  {' شناسه درخواست: '}
                  <bdi dir="ltr">{problem.requestId}</bdi>
                </>
              )
            : null}
        </p>
      ) : null}
    </div>
  );
}
