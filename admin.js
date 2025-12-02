const API_URL = 'https://game-a5vt.onrender.com/api'; // The full URL of your backend API

document.addEventListener('DOMContentLoaded', () => {
    fetchAllStudents();
    document.getElementById('add-student-btn').addEventListener('click', addStudent);
});

async function fetchAllStudents() {
    try {
        const response = await fetch(`${API_URL}/admin/students`);
        if (!response.ok) throw new Error('Failed to fetch student data.');
        
        const students = await response.json();
        renderStudentTable(students);
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
            <td>${student.overallScore}</td>
            <td><button class="btn btn-danger" onclick="deleteStudent('${student.studentId}')">Delete</button></td>
        `;
        tableBody.appendChild(row);
    });
}

async function deleteStudent(studentId) {
    if (!confirm(`Are you sure you want to delete student ${studentId}? This cannot be undone.`)) return;

    // We can reuse the existing DELETE endpoint
    await fetch(`${API_URL}/students/${studentId}`, { method: 'DELETE' });
    
    // Refresh the table
    fetchAllStudents();
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
        document.getElementById('new-student-id').value = '';
        document.getElementById('new-student-name').value = '';
        document.getElementById('new-student-class').value = '';
        fetchAllStudents();
    } catch (error) {
        console.error('Error adding student:', error);
        alert('Failed to add student. The Student ID might already exist.');
    }
}