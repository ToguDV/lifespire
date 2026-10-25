import { dialogDraftShouldReset } from './TaskFormDialog'

// lucide-react-native ships ESM only, which the mobile jest setup cannot
// require; the draft guard under test never renders icons.
jest.mock('lucide-react-native', () => {
  const Dummy = () => null
  return new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === '__esModule') return true
        if (property === 'default') return {}
        return Dummy
      },
    },
  )
})

describe('task dialog draft', () => {
  it('resets when the dialog opens', () => {
    expect(
      dialogDraftShouldReset({ visible: false, id: undefined }, { visible: true, id: undefined }),
    ).toBe(true)
    expect(
      dialogDraftShouldReset({ visible: false, id: 't1' }, { visible: true, id: 't1' }),
    ).toBe(true)
  })

  it('keeps the typed title when goals refresh with the dialog open', () => {
    // Dialog open editing t1; the user typed a title; a background sync
    // refreshes the goals array (same edited routine, new identities).
    let draftTitle = 'Walk the north trail'
    const prev = { visible: true, id: 't1' }
    const next = { visible: true, id: 't1' }
    if (dialogDraftShouldReset(prev, next)) draftTitle = 'Stored title'
    expect(draftTitle).toBe('Walk the north trail')
  })

  it('resets when switching to another routine', () => {
    expect(
      dialogDraftShouldReset({ visible: true, id: 't1' }, { visible: true, id: 't2' }),
    ).toBe(true)
  })

  it('never resets while closed', () => {
    expect(
      dialogDraftShouldReset({ visible: true, id: 't1' }, { visible: false, id: 't1' }),
    ).toBe(false)
    expect(
      dialogDraftShouldReset(
        { visible: false, id: undefined },
        { visible: false, id: undefined },
      ),
    ).toBe(false)
  })
})
