'use client';

import { Component, type ReactNode } from 'react';

interface ViewErrorBoundaryProps {
  /** Named so the message can say which screen failed. */
  name: string;
  children: ReactNode;
}

interface ViewErrorBoundaryState {
  message: string | null;
}

// Scoped per view so a failure in ranking or insight building cannot blank the
// whole app and strand the user with no navigation.
export class ViewErrorBoundary extends Component<
  ViewErrorBoundaryProps,
  ViewErrorBoundaryState
> {
  state: ViewErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown) {
    return {
      message:
        error instanceof Error
          ? error.message
          : 'This screen could not render.',
    };
  }

  componentDidCatch(error: unknown) {
    console.error(`[Next Chapter] ${this.props.name} view failed`, error);
  }

  render() {
    if (this.state.message === null) return this.props.children;

    return (
      <div
        role="alert"
        className="border-destructive/35 bg-destructive/10 rounded-xl border p-5 sm:p-6"
      >
        <h2 className="text-xl font-semibold">
          The {this.props.name} screen could not be shown
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Your library is unchanged. Try another tab, or reload the app.
        </p>
        <p className="text-destructive mt-3 text-xs leading-5">
          {this.state.message}
        </p>
        <button
          type="button"
          onClick={() => this.setState({ message: null })}
          className="bg-primary text-primary-foreground mt-4 inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }
}
