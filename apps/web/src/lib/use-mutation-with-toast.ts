import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

type ToastMessages = {
  loading?: string;
  success?: string;
  error?: string;
};

const t = toast as any;

export function useMutationWithToast<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext> & {
    toast: ToastMessages;
  },
) {
  const { toast: messages, ...mutationOptions } = options;

  return useMutation({
    ...mutationOptions,
    onMutate: async (variables: TVariables) => {
      if (messages.loading) t.loading(messages.loading, { id: 'mutation' });
      return (mutationOptions.onMutate as any)?.(variables) as TContext;
    },
    onSuccess: (data: TData, variables: TVariables, context: TContext) => {
      t.dismiss('mutation');
      t.success(messages.success ?? 'Operazione completata');
      (mutationOptions.onSuccess as any)?.(data, variables, context);
    },
    onError: (error: TError, variables: TVariables, context: TContext | undefined) => {
      t.dismiss('mutation');
      t.error(messages.error ?? 'Operazione fallita');
      (mutationOptions.onError as any)?.(error, variables, context);
    },
  });
}
