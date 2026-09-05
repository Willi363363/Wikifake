// `next/font/google`, as vitest can see it.
//
// It is not a runtime module: Next's compiler rewrites each call at build time
// into a self-hosted `@font-face` and a generated class name. Under vitest
// there is no such compiler, so the import resolves to something that is not a
// function and every test that renders the layout fails on it — a long way from
// the cause.
//
// The stub returns the same shape the real one does, which is all the layout
// uses: a `variable` naming the custom property, and a `className`. What that
// means for `fonts.test.ts` is that it reads the layout's source rather than
// calling it — a stub cannot tell you which family was asked for, so a test
// that trusted this one would be testing the stub.
interface Face {
  readonly variable: string;
  readonly className: string;
  readonly style: { readonly fontFamily: string };
}

function face(options: { variable?: string } = {}): Face {
  const variable = options.variable ?? '--font-stub';
  return {
    variable: `stub_${variable.replace(/^--/, '')}`,
    className: 'stub-font',
    style: { fontFamily: 'stub' },
  };
}

export const Archivo = face;
export const JetBrains_Mono = face;
