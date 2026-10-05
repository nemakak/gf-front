// === ADMIN: пополнение каталога из приложения ===
app.post('/api/admin/refresh-catalog', async (req, res) => {
  const { initData, category } = req.body;
  const tgUser = verifyTelegramInitData(initData);
  if (!tgUser) return res.status(401).json({ error: 'Unauthorized' });
  if (!(await isAdmin(tgUser.id))) return res.status(403).json({ error: 'Forbidden' });
  try {
    const cat = category || 'all';
    const result = await refreshCatalog(cat === 'all' ? 'all' : cat);
    res.json(result);
  } catch (e) {
    logError('admin-refresh', e.message);
    res.status(500).json({ success: false, error: e.message, reason: e.message });
  }
});
