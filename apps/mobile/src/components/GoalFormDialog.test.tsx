import { dialogDraftShouldReset } from './GoalFormDialog'

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

describe('goal dialog draft', () => {
  it('resets when the dialog opens', () => {
    expect(
      dialogDraftShouldReset({ visible: false, id: undefined }, { visible: true, id: undefined }),
    ).toBe(true)
    expect(
      dialogDraftShouldReset({ visible: false, id: 'g1' }, { visible: true, id: 'g1' }),
    ).toBe(true)
  })

  it('keeps the typed title when goals refresh with the dialog open', () => {
    // Dialog open editing g1; the user typed a title; a background sync
    // refreshes the goals array (same edited goal, new identities).
    let draftTitle = 'Morning run'
    const prev = { visible: true, id: 'g1' }
    const next = { visible: true, id: 'g1' }
    if (dialogDraftShouldReset(prev, next)) draftTitle = 'Stored title'
    expect(draftTitle).toBe('Morning run')
  })

  it('resets when switching to another goal', () => {
    expect(
      dialogDraftShouldReset({ visible: true, id: 'g1' }, { visible: true, id: 'g2' }),
    ).toBe(true)
  })

  it('never resets while closed', () => {
    expect(
      dialogDraftShouldReset({ visible: true, id: 'g1' }, { visible: false, id: 'g1' }),
    ).toBe(false)
    expect(
      dialogDraftShouldReset(
        { visible: false, id: undefined },
        { visible: false, id: undefined },
      ),
    ).toBe(false)
  })
})
