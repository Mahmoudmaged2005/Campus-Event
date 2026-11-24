import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { writeAuditLog } from '../audit/audit.service.js';

export async function listAllCategories() {
  return db().category.findMany({
    include: { _count: { select: { events: true } } },
    orderBy: { name: 'asc' },
  });
}

async function checkNameIsFree(name, ignoreCategoryId) {
  const sameName = await db().category.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });
  if (sameName !== null && sameName.id !== ignoreCategoryId) {
    throw new AppError(409, 'A category with this name already exists');
  }
}

async function findCategory(categoryId) {
  const category = await db().category.findUnique({ where: { id: categoryId } });
  if (category === null) {
    throw new AppError(404, 'Category not found');
  }
  return category;
}

export async function createCategory(adminId, name) {
  await checkNameIsFree(name, null);
  const category = await db().category.create({ data: { name: name } });
  await writeAuditLog(adminId, 'category.created', 'Category', category.id, { name: name });
  return category;
}

export async function updateCategory(adminId, categoryId, changes) {
  const oldCategory = await findCategory(categoryId);
  if (changes.name !== undefined) {
    await checkNameIsFree(changes.name, categoryId);
  }
  const category = await db().category.update({ where: { id: categoryId }, data: changes });
  await writeAuditLog(adminId, 'category.updated', 'Category', categoryId, {
    oldName: oldCategory.name,
    newName: category.name,
    oldIsActive: oldCategory.isActive,
    newIsActive: category.isActive,
  });
  return category;
}
