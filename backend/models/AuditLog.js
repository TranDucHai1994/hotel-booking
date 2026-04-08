const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entity_id: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
}, { versionKey: false });

module.exports = mongoose.model('AuditLog', auditLogSchema);

