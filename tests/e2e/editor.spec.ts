import { test, expect } from '@playwright/test'

/**
 * E2E tests for the aprover web interface
 *
 * These tests verify the complete user experience of the
 * MTS (Метатеория Связей) prover web application.
 */

test.describe('aprover Web Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display the main page with correct title', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('aprover')
    await expect(page.locator('.subtitle')).toContainText('Ассоциативный прувер')
  })

  test('should have editor and results panels', async ({ page }) => {
    await expect(page.locator('.editor-panel')).toBeVisible()
    await expect(page.locator('.results-panel')).toBeVisible()
    await expect(page.locator('.code-input')).toBeVisible()
  })

  test('should have default MTS formulas in editor', async ({ page }) => {
    const editor = page.locator('.code-input')
    const value = await editor.inputValue()
    expect(value).toContain('МТС')
    expect(value).toContain('∞')
  })

  test('should verify default formulas successfully', async ({ page }) => {
    // The default formulas should be verified and shown in results
    const results = page.locator('.result-item')
    await expect(results.first()).toBeVisible()

    // All default formulas should pass
    const successItems = page.locator('.result-item.success')
    await expect(successItems.first()).toBeVisible()
  })

  test('should update results when editor content changes', async ({ page }) => {
    const editor = page.locator('.code-input')

    // Clear editor and enter a simple valid formula
    await editor.fill('∞ = ∞.')

    // Wait for results to update
    await expect(page.locator('.result-item')).toHaveCount(1)
    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should show success indicator for valid equality', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a = a.')

    const resultItem = page.locator('.result-item')
    await expect(resultItem).toHaveClass(/success/)
    await expect(page.locator('.result-status')).toHaveText('✓')
  })

  test('should show failure indicator for invalid equality', async ({ page }) => {
    const editor = page.locator('.code-input')
    // Using different structures that cannot be unified:
    // ♂∞ (male of infinity) cannot equal ∞♀ (female of infinity)
    await editor.fill('♂∞ = ∞♀.')

    const resultItem = page.locator('.result-item')
    await expect(resultItem).toHaveClass(/failure/)
    await expect(page.locator('.result-status')).toHaveText('✗')
  })

  test('should show error for invalid syntax', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('invalid syntax !!!')

    await expect(page.locator('.error-panel')).toBeVisible()
  })

  test('should verify infinity axiom (А4)', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('∞ = ∞ -> ∞.')

    await expect(page.locator('.result-item.success')).toBeVisible()
    await expect(page.locator('.result-status')).toHaveText('✓')
  })

  test('should verify male self-closing axiom (А5)', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('♂v = ♂v -> v.')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify female self-closing axiom (А6)', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('r♀ = r -> r♀.')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify inversion axiom (А7)', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('!♂x = x♀.')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify power expansion', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a^2 = a -> a.')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify multiple formulas', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill(`
∞ = ∞ -> ∞.
♂v = ♂v -> v.
r♀ = r -> r♀.
`)

    const results = page.locator('.result-item')
    await expect(results).toHaveCount(3)

    // All formulas should be successful
    const successItems = page.locator('.result-item.success')
    await expect(successItems).toHaveCount(3)
  })

  test('should verify inequality', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('♂∞ != ∞♀.')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should handle left associativity (А11)', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a -> b -> c = (a -> b) -> c.')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should have GitHub link in footer', async ({ page }) => {
    const footer = page.locator('footer')
    await expect(footer).toContainText('GitHub')
    await expect(page.locator('footer a')).toHaveAttribute(
      'href',
      'https://github.com/netkeep80/aprover'
    )
  })

  test('should have AST viewer panel', async ({ page }) => {
    // AST viewer should be visible by default
    await expect(page.locator('.ast-panel')).toBeVisible()
    await expect(page.locator('.ast-viewer')).toBeVisible()
  })

  test('should toggle AST viewer visibility', async ({ page }) => {
    // Initially visible
    await expect(page.locator('.ast-panel')).toBeVisible()

    // Click toggle button to hide
    await page.locator('.toggle-btn').click()
    await expect(page.locator('.ast-panel')).not.toBeVisible()

    // Click toggle button to show again
    await page.locator('.toggle-btn').click()
    await expect(page.locator('.ast-panel')).toBeVisible()
  })

  test('should have AST expand/collapse controls', async ({ page }) => {
    // AST viewer should have expand/collapse buttons
    await expect(page.locator('.ast-controls')).toBeVisible()
    await expect(page.locator('.ast-btn').first()).toBeVisible()
    await expect(page.locator('.ast-btn').nth(1)).toBeVisible()
  })

  test('should collapse all AST nodes', async ({ page }) => {
    // Enter a formula to generate AST
    const editor = page.locator('.code-input')
    await editor.fill('a -> b.')

    // Wait for AST to render
    await expect(page.locator('.tree-root')).toBeVisible()

    // Click collapse all button
    await page.locator('.ast-btn').nth(1).click()

    // After collapse, the Statement level should show collapsed indicator
    // (Statement is a child of File, and collapse all keeps only File expanded)
    const statementToggle = page
      .locator('.tree-node-content')
      .filter({ hasText: 'Statement' })
      .first()
      .locator('.tree-toggle')
    await expect(statementToggle).toHaveText('▶')
  })

  test('should expand all AST nodes after collapse', async ({ page }) => {
    // Enter a formula to generate AST
    const editor = page.locator('.code-input')
    await editor.fill('a -> b.')

    // Wait for AST to render
    await expect(page.locator('.tree-root')).toBeVisible()

    // Collapse all first
    await page.locator('.ast-btn').nth(1).click()

    // Now expand all
    await page.locator('.ast-btn').first().click()

    // Tree children should be visible again
    const treeChildren = page.locator('.tree-children')
    await expect(treeChildren.first()).toBeVisible()
  })

  test('should display node location in AST tree', async ({ page }) => {
    // Enter a simple formula
    const editor = page.locator('.code-input')
    await editor.fill('a = a.')

    // Wait for AST to render
    await expect(page.locator('.tree-root')).toBeVisible()

    // Check that location info is displayed (format: [line:column])
    await expect(page.locator('.tree-loc').first()).toBeVisible()
    await expect(page.locator('.tree-loc').first()).toContainText('[')
  })

  test('should highlight source code when hovering AST node', async ({ page }) => {
    // Enter a simple formula
    const editor = page.locator('.code-input')
    await editor.fill('a = a.')

    // Wait for AST to render
    await expect(page.locator('.tree-root')).toBeVisible()

    // Find a tree node (e.g., the Identifier node)
    const treeNodes = page.locator('.tree-node-content')
    const identifierNode = treeNodes.filter({ hasText: 'Identifier' }).first()

    // Hover over the node
    await identifierNode.hover()

    // Check that the highlight appears in the editor
    await expect(page.locator('.ast-highlight')).toBeVisible()
  })

  test('should remove highlight when mouse leaves AST node', async ({ page }) => {
    // Enter a simple formula
    const editor = page.locator('.code-input')
    await editor.fill('a = a.')

    // Wait for AST to render
    await expect(page.locator('.tree-root')).toBeVisible()

    // Find a tree node
    const treeNodes = page.locator('.tree-node-content')
    const identifierNode = treeNodes.filter({ hasText: 'Identifier' }).first()

    // Hover over the node
    await identifierNode.hover()
    await expect(page.locator('.ast-highlight')).toBeVisible()

    // Move mouse away (hover over header)
    await page.locator('.app-header').hover()

    // Highlight should disappear
    await expect(page.locator('.ast-highlight')).not.toBeVisible()
  })

  test('should toggle individual AST nodes', async ({ page }) => {
    // Enter a formula with nested structure
    const editor = page.locator('.code-input')
    await editor.fill('a -> b.')

    // Wait for AST to render with children visible
    await expect(page.locator('.tree-root')).toBeVisible()
    const treeChildren = page.locator('.tree-children')
    await expect(treeChildren.first()).toBeVisible()

    // First collapse all to get to a known state
    await page.locator('.ast-btn').nth(1).click()

    // Now expand Statement node by clicking on it
    const statementNode = page
      .locator('.tree-node-content')
      .filter({ hasText: 'Statement' })
      .first()
    await statementNode.click()

    // After clicking collapsed node, it should expand (show ▼)
    const toggleIndicator = statementNode.locator('.tree-toggle')
    await expect(toggleIndicator).toHaveText('▼')

    // Click again to collapse
    await statementNode.click()
    await expect(toggleIndicator).toHaveText('▶')
  })

  // Phase 2.4: Enhanced Prover Tests

  test('should show expand toggle for proof steps', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('∞ = ∞ -> ∞.')

    // Wait for result to appear
    await expect(page.locator('.result-item')).toBeVisible()

    // Should have expand toggle indicator
    await expect(page.locator('.expand-toggle')).toBeVisible()
  })

  test('should expand proof details when clicking result', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('∞ = ∞ -> ∞.')

    // Wait for result to appear
    const resultItem = page.locator('.result-item')
    await expect(resultItem).toBeVisible()

    // Click to expand
    await resultItem.locator('.result-header').click()

    // Should show proof details section
    await expect(page.locator('.proof-details')).toBeVisible()
    await expect(page.locator('.proof-steps-header')).toBeVisible()
  })

  test('should display proof steps with axiom references', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('∞ = ∞ -> ∞.')

    // Wait for result and expand it
    const resultItem = page.locator('.result-item')
    await expect(resultItem).toBeVisible()
    await resultItem.locator('.result-header').click()

    // Should show proof steps
    await expect(page.locator('.proof-step').first()).toBeVisible()

    // Should show axiom badge (A4 for infinity axiom)
    await expect(page.locator('.step-axiom').first()).toBeVisible()
  })

  test('should display step transformations', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('♂v = ♂v -> v.')

    // Wait for result and expand it
    const resultItem = page.locator('.result-item')
    await expect(resultItem).toBeVisible()
    await resultItem.locator('.result-header').click()

    // Should show transformation with before/after
    await expect(page.locator('.step-transformation').first()).toBeVisible()
  })

  test('should show axiom info on proof steps', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('r♀ = r -> r♀.')

    // Wait for result and expand it
    const resultItem = page.locator('.result-item')
    await expect(resultItem).toBeVisible()
    await resultItem.locator('.result-header').click()

    // Should show axiom information
    await expect(page.locator('.step-axiom-info').first()).toBeVisible()
    await expect(page.locator('.axiom-name').first()).toBeVisible()
    await expect(page.locator('.axiom-formula').first()).toBeVisible()
  })

  test('should show hints for failed verification', async ({ page }) => {
    const editor = page.locator('.code-input')
    // Use a formula that will fail to prove
    await editor.fill('♂∞ = ∞♀.')

    // Wait for failed result and expand it
    const resultItem = page.locator('.result-item.failure')
    await expect(resultItem).toBeVisible()
    await resultItem.locator('.result-header').click()

    // Should show hints section
    await expect(page.locator('.proof-hints')).toBeVisible()
    await expect(page.locator('.hint-item').first()).toBeVisible()
  })

  test('should collapse proof details on second click', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a = a.')

    // Wait for result and expand it
    const resultItem = page.locator('.result-item')
    await expect(resultItem).toBeVisible()
    await resultItem.locator('.result-header').click()

    // Details should be visible
    await expect(page.locator('.proof-details')).toBeVisible()

    // Click again to collapse
    await resultItem.locator('.result-header').click()

    // Details should be hidden
    await expect(page.locator('.proof-details')).not.toBeVisible()
  })

  test('should show definition registration steps', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('mydef : a -> b.')

    // Wait for result and expand it
    const resultItem = page.locator('.result-item')
    await expect(resultItem).toBeVisible()
    await resultItem.locator('.result-header').click()

    // Should show definition registration step
    await expect(page.locator('.proof-step').first()).toBeVisible()
    await expect(page.locator('.step-action').first()).toContainText('Регистрация')
  })
})
