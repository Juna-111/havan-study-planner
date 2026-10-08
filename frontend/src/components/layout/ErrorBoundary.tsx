'use client'

import React, { Component, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorIllustration } from '@/components/brand/illustrations'
import { Button, Card } from '@/components/ui'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info)
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <main
          style={{
            minHeight: '100svh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
            background: 'var(--color-canvas)',
          }}
        >
          <Card
            padding="lg"
            style={{
              width: 'min(100%, 460px)',
              textAlign: 'center',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 120,
                height: 120,
                margin: '0 auto 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ErrorIllustration size={120} />
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.4rem',
                color: 'var(--color-primary)',
                marginTop: 8,
                marginBottom: 6,
              }}
            >
              Something interrupted your study flow
            </h2>
            <p
              style={{
                color: 'var(--color-muted)',
                fontSize: '0.92rem',
                lineHeight: 1.55,
                marginBottom: 18,
              }}
            >
              We hit an unexpected issue while loading this page. Don’t worry —
              your progress is still safe. Let’s head back to your Havan dashboard.
            </p>
            <Button onClick={this.handleGoHome}>Go Home</Button>
          </Card>
        </main>
      )
    }

    return this.props.children
  }
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const router = useRouter()
  return (
    <ErrorBoundaryClass
      fallback={fallback}
      onReset={() => router.replace('/student/havan')}
    >
      {children}
    </ErrorBoundaryClass>
  )
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode,
) {
  const Wrapped: React.FC<P> = (props) => (
    <ErrorBoundary fallback={fallback}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )
  Wrapped.displayName = `withErrorBoundary(${WrappedComponent.displayName ?? WrappedComponent.name})`
  return Wrapped
}

export default ErrorBoundary
