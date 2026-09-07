import { forbidden, notFound } from '../utils/errors.js';

export class TenantRepository {
  constructor(model) { this.model = model; }
  list(organizationId, filter = {}, options = {}) { return this.model.find({ ...filter, organizationId }, null, options); }
  findOne(organizationId, filter = {}) { return this.model.findOne({ ...filter, organizationId }); }
  async requireOne(organizationId, filter = {}) {
    const record = await this.findOne(organizationId, filter);
    if (!record) throw notFound(this.model.modelName);
    return record;
  }
  create(organizationId, values) {
    if (values.organizationId && String(values.organizationId) !== String(organizationId)) throw forbidden('Cross-tenant write rejected');
    return this.model.create({ ...values, organizationId });
  }
  updateOne(organizationId, filter, update, options = {}) { return this.model.findOneAndUpdate({ ...filter, organizationId }, update, { new: true, runValidators: true, ...options }); }
  deleteOne(organizationId, filter) { return this.model.deleteOne({ ...filter, organizationId }); }
}
