import { db } from '../db/knex';

export async function findActiveServices(accountId: number) {
  return db('services as sv')
    .join('specialist_services as ss', function joinAssignment() {
      this.on('ss.service_id', '=', 'sv.id').andOn('ss.account_id', '=', 'sv.account_id');
    })
    .join('specialists as sp', function joinSpecialist() {
      this.on('sp.id', '=', 'ss.specialist_id').andOn('sp.account_id', '=', 'ss.account_id');
    })
    .where({ 'sv.account_id': accountId, 'sv.is_active': true, 'ss.is_active': true, 'sp.is_active': true })
    .distinct('sv.*')
    .orderBy('sv.id', 'asc');
}

export async function findServiceById(accountId: number, id: number, specialistId?: number) {
  const query = db('services as sv').where({ 'sv.account_id': accountId, 'sv.id': id, 'sv.is_active': true });
  if (specialistId !== undefined) {
    query.join('specialist_services as ss', function joinAssignment() {
      this.on('ss.service_id', '=', 'sv.id').andOn('ss.account_id', '=', 'sv.account_id');
    }).join('specialists as sp', function joinSpecialist() {
      this.on('sp.id', '=', 'ss.specialist_id').andOn('sp.account_id', '=', 'ss.account_id');
    }).where({ 'ss.specialist_id': specialistId, 'ss.is_active': true, 'sp.is_active': true })
      .select('sv.*', db.raw('COALESCE(ss.price_override, sv.price) as price'),
        db.raw('COALESCE(ss.duration_override_minutes, sv.duration_min) as duration_min'));
  } else {
    query.select('sv.*');
  }
  return query.first();
}

export async function findAssignedActiveSpecialists(accountId: number, serviceId: number) {
  return db('specialists as sp')
    .join('specialist_services as ss', function joinAssignment() {
      this.on('ss.specialist_id', '=', 'sp.id').andOn('ss.account_id', '=', 'sp.account_id');
    })
    .where({
      'sp.account_id': accountId, 'ss.service_id': serviceId,
      'sp.is_active': true, 'ss.is_active': true,
    })
    .orderBy('sp.id', 'asc')
    .select('sp.*', db.raw('COALESCE(ss.price_override, 0) as service_price_override'),
      'ss.duration_override_minutes');
}
