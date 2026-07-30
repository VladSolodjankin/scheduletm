import { Component, type ErrorInfo, type ReactNode } from 'react';

type BlockErrorBoundaryProps = {
  blockId: string;
  children: ReactNode;
  fallback: ReactNode;
};

type BlockErrorBoundaryState = {
  hasError: boolean;
};

export class BlockErrorBoundary extends Component<BlockErrorBoundaryProps, BlockErrorBoundaryState> {
  public state: BlockErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): BlockErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Public page block render error', {
      blockId: this.props.blockId,
      error,
      componentStack: errorInfo.componentStack,
    });
  }

  public componentDidUpdate(previousProps: BlockErrorBoundaryProps): void {
    if (this.state.hasError && previousProps.blockId !== this.props.blockId) {
      this.setState({ hasError: false });
    }
  }

  public render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
