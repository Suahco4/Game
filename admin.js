const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocal ? 'http://localhost:3000/api' : 'https://game-a5vt.onrender.com/api';

let allStudents = []; // Store all students to enable client-side searching

document.addEventListener('DOMContentLoaded', () => {
    fetchAllStudents();
    document.getElementById('add-student-btn').addEventListener('click', addStudent);
    document.getElementById('generate-admin-id-btn').addEventListener('click', generateAndFillId);
    document.getElementById('save-changes-btn').addEventListener('click', saveStudentChanges);
    document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
    document.getElementById('search-input').addEventListener('input', handleSearch);
});


async function fetchAllStudents() {
    try {
        const response = await fetch(`${API_URL}/admin/students`);
        if (!response.ok) throw new Error('Failed to fetch student data.');
        
        allStudents = await response.json();
        renderStudentTable(allStudents);
    } catch (error) {
        console.error('Error fetching students:', error);
        document.getElementById('student-table-body').innerHTML = `<tr><td colspan="8">Error loading data. Is the server running?</td></tr>`;
    }
}

function renderStudentTable(students) {
    const tableBody = document.getElementById('student-table-body');
    tableBody.innerHTML = ''; // Clear existing rows

    if (students.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8">No students found in the database.</td></tr>`;
        return;
    }

    students.forEach(student => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.studentId}</td>
            <td>${student.name}</td>
            <td>${student.class}</td>
            <td>${student.sessions}</td>
            <td>${student.badges.length}</td>
            <td>${student.highScore}</td>
            <td>${student.overallScore || 0}</td>
            <td>
                <button class="btn btn-secondary" style="margin-right: 5px;" onclick="editStudent('${student.studentId}')">Edit</button>
                <button class="btn btn-danger" onclick="deleteStudent('${student.studentId}')">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function deleteStudent(studentId) {
    if (!confirm(`Are you sure you want to delete student ${studentId}? This cannot be undone.`)) return;

    try {
        const response = await fetch(`${API_URL}/students/${studentId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete student.');
        fetchAllStudents(); // Refresh the table on success
    } catch (error) {
        console.error('Error deleting student:', error);
        alert('Could not delete student. The server may be down.');
    }
}

async function addStudent() {
    const studentId = document.getElementById('new-student-id').value.trim();
    const name = document.getElementById('new-student-name').value.trim();
    const studentClass = document.getElementById('new-student-class').value.trim();

    if (!studentId || !name || !studentClass) {
        alert('Please fill out all fields to add a student.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, name, class: studentClass })
        });

        if (!response.ok) throw new Error('Server responded with an error.');

        // Clear form and refresh table
        resetForm();
    } catch (error) {
        console.error('Error adding student:', error);
        alert('Failed to add student. The Student ID might already exist.');
    }
}

function generateAndFillId() {
    // Generate 7 random digits, padded with leading zeros if necessary
    const randomPart = String(Math.floor(Math.random() * 10000000)).padStart(7, '0');
    const newId = `044${randomPart}`;
    // Fill the input field with the new ID and ensure it's editable
    document.getElementById('new-student-id').readOnly = false;
    document.getElementById('new-student-id').value = newId;
}

function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    if (!searchTerm) {
        renderStudentTable(allStudents); // If search is empty, show all students
        return;
    }

    const filteredStudents = allStudents.filter(student => 
        student.name.toLowerCase().includes(searchTerm) ||
        student.studentId.toLowerCase().includes(searchTerm)
    );

    renderStudentTable(filteredStudents);
}

function editStudent(studentId) {
    const student = allStudents.find(s => s.studentId === studentId);
    if (!student) return;

    // Populate the form
    document.getElementById('new-student-id').value = student.studentId;
    document.getElementById('new-student-name').value = student.name;
    document.getElementById('new-student-class').value = student.class;

    // Change form to "Edit Mode"
    document.getElementById('add-student-form').querySelector('h3').textContent = 'Edit Student';
    document.getElementById('new-student-id').readOnly = true; // ID should not be changed
    document.getElementById('generate-admin-id-btn').classList.add('hidden');
    document.getElementById('add-student-btn').classList.add('hidden');
    document.getElementById('save-changes-btn').classList.remove('hidden');
    document.getElementById('cancel-edit-btn').classList.remove('hidden');

    // Scroll to the form
    document.getElementById('add-student-form').scrollIntoView({ behavior: 'smooth' });
}

async function saveStudentChanges() {
    const studentId = document.getElementById('new-student-id').value;
    const name = document.getElementById('new-student-name').value.trim();
    const studentClass = document.getElementById('new-student-class').value.trim();

    if (!name || !studentClass) {
        alert('Name and Class cannot be empty.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/students/${studentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, class: studentClass })
        });

        if (!response.ok) throw new Error('Failed to save changes.');

        resetForm();
    } catch (error) {
        console.error('Error saving changes:', error);
        alert('Could not save changes. Please try again.');
    }
}

function cancelEdit() {
    resetForm();
}

function resetForm() {
    document.getElementById('add-student-form').querySelector('h3').textContent = 'Add New Student';
    document.getElementById('new-student-id').value = '';
    document.getElementById('new-student-name').value = '';
    document.getElementById('new-student-class').value = '';
    document.getElementById('generate-admin-id-btn').classList.remove('hidden');
    document.getElementById('add-student-btn').classList.remove('hidden');
    document.getElementById('save-changes-btn').classList.add('hidden');
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    fetchAllStudents(); // Refresh the table
}