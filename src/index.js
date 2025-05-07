app.post('/api/public/pop-submission', async (req, res) => {
  const {
    fullname,
    email,
    phone,
    studentName,
    amount,
    paymentDate,
    paymentMethod,
    bankName,
    firebaseFileURL, // Optional: only include if storing this
  } = req.body;

  if (!fullname || !email || !phone || !studentName || !amount || !paymentDate || !paymentMethod || !bankName) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const sql = `
      INSERT INTO pop_submission (fullname, email, phone, studentName, amount, paymentDate, paymentMethod, bankName${firebaseFileURL ? ', firebaseFileURL' : ''})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?${firebaseFileURL ? ', ?' : ''})`;

    const values = [fullname, email, phone, studentName, amount, paymentDate, paymentMethod, bankName];
    if (firebaseFileURL) values.push(firebaseFileURL);

    await query(sql, values);

    res.status(201).json({ message: 'POP submission successful!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error submitting POP', error: error.message });
  }
});
