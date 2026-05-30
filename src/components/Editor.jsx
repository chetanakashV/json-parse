import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { useCallback } from 'react'

export default function Editor({ value, onChange, theme, isDark }) {
  const handleChange = useCallback((val) => onChange(val), [onChange])

  return (
    <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <CodeMirror
        value={value}
        onChange={handleChange}
        extensions={[json()]}
        theme={theme}
        height="100%"
        style={{ height: '100%', fontSize: 13 }}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          indentOnInput: true,
          tabSize: 2,
        }}
      />
    </div>
  )
}
